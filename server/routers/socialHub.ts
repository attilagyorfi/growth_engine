/**
 * G2A Growth Engine – Social Hub router (G2)
 *
 * connection.*: a kapcsolat kezelése, csak rendszergazdának (superAdminProcedure). A kulcs
 * soha nem megy vissza a kliensre, legfeljebb az utolsó 4 karaktere; a teljes ügyféllista is
 * csak itt látszik.
 * previewSend / send / repeat: a profilhoz hozzáférő felhasználónak (assertProfileOwnership).
 * A posztokat mindig a profil saját posztjai közül vesszük, így idegen poszt NOT_FOUND.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, appUserProcedure, superAdminProcedure } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import { getContentByProfile, getProfileById, listProfileBrands } from "../db";
import { createSocialHubClient, getSocialHubConfig } from "../socialHub/client";
import { encryptApiKey, resolveSocialHubConfig, SOCIAL_HUB_RESOLVE_ERROR } from "../socialHub/config";
import { isInBudapestMonth } from "../socialHub/drafts";
import { previewSend, repeatAttempt, sendPosts, userMessage, type SendTargetRef } from "../socialHub/send";
import { getSocialHubStore, type SocialHubStore, type StoredConnection } from "../socialHub/store";
import { assertSocialHubUrl, SocialHubUrlError } from "../socialHub/urlGuard";
import { assertBrandInProfile } from "./brands";

export const PROFILE_TARGET = "profile";

function requireStore(): SocialHubStore {
  const store = getSocialHubStore();
  if (!store) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A Social Hubba küldés még nem érhető el." });
  return store;
}

/** A tárolóhiba eredeti szövege (SQL-paraméterek) nem kerülhet naplóba vagy válaszba. */
async function guardStorage<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A kapcsolatot most nem sikerült menteni. Próbáld újra." });
  }
}

async function loadRefs(profileId: string): Promise<SendTargetRef[]> {
  const profile = await getProfileById(profileId);
  if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Az ügyfél nem található." });
  const brands = await listProfileBrands(profileId);
  return [
    { id: PROFILE_TARGET, name: profile.name, externalRef: profile.externalRef },
    ...brands.map((b) => ({ id: b.id, name: b.name, externalRef: b.socialHubExternalRef })),
  ].filter((r) => r.externalRef);
}

async function loadOwnPosts(profileId: string, ids: string[]) {
  const own = new Map((await getContentByProfile(profileId)).map((p) => [p.id, p]));
  return Array.from(new Set(ids)).map((id) => {
    const post = own.get(id);
    if (!post || post.profileId !== profileId) throw new TRPCError({ code: "NOT_FOUND", message: "A poszt nem található." });
    return post;
  });
}

const id = z.string().min(1).max(64);
const accountChoices = z.record(z.string().max(32), z.string().max(64));

export const socialHubRouter = router({
  /** Elérhető-e a küldés (van-e tároló) — a felület e szerint mutatja a gombokat. */
  available: appUserProcedure.query(() => ({ available: getSocialHubStore() !== null })),

  connection: router({
    get: superAdminProcedure.query(async () => {
      const store = getSocialHubStore();
      let stored: StoredConnection | null;
      try {
        stored = store ? await store.getConnection() : null;
      } catch {
        return { available: true, source: "error" as const, baseUrl: null, keyLast4: null };
      }
      if (stored) {
        const resolved = await resolveSocialHubConfig();
        return {
          available: true,
          source: resolved.status === "ok" ? ("stored" as const) : ("error" as const),
          baseUrl: stored.baseUrl,
          keyLast4: stored.apiKeyLast4,
        };
      }
      return { available: store !== null, source: getSocialHubConfig() ? ("env" as const) : ("none" as const), baseUrl: null, keyLast4: null };
    }),

    // A kulcs mindig kötelező: új címre a régi kulcs nem mehet.
    save: superAdminProcedure
      .input(z.object({
        baseUrl: z.string().trim().min(1, "Add meg az API-címet.").max(500),
        apiKey: z.string().trim().regex(/^[\x21-\x7e]{16,512}$/, "Add meg a teljes API-kulcsot."),
      }))
      .mutation(async ({ input, ctx }) => {
        const store = requireStore();
        let baseUrl: string;
        try {
          baseUrl = await assertSocialHubUrl(input.baseUrl);
        } catch (err) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof SocialHubUrlError ? err.message : "Ez a cím nem használható." });
        }
        const apiKeyEnc = encryptApiKey(input.apiKey);
        if (!apiKeyEnc) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A kulcsot most nem tudjuk biztonságosan tárolni, ezért nem mentettük el." });
        }
        const keyLast4 = input.apiKey.slice(-4);
        await guardStorage(() => store.saveConnection({ baseUrl, apiKeyEnc, apiKeyLast4: keyLast4, updatedBy: ctx.appUser.id }));
        return { baseUrl, keyLast4 };
      }),

    check: superAdminProcedure.mutation(async () => {
      const resolved = await resolveSocialHubConfig();
      if (resolved.status === "error") return { ok: false as const, message: SOCIAL_HUB_RESOLVE_ERROR };
      if (resolved.status === "not_configured") return { ok: false as const, message: "Még nincs Social Hub-kapcsolat." };
      try {
        const clients = await createSocialHubClient(resolved.config).listClients();
        return { ok: true as const, clients: clients.map((c) => ({ name: c.name, externalRef: c.external_ref })) };
      } catch (err) {
        return { ok: false as const, message: userMessage(err) };
      }
    }),

    disconnect: superAdminProcedure.mutation(async () => {
      const store = requireStore();
      await guardStorage(() => store.deleteConnection());
      return { ok: true as const };
    }),
  }),

  previewSend: appUserProcedure
    .input(z.object({
      profileId: id,
      selection: z.union([
        z.object({ postId: id }).strict(),
        z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict(),
      ]),
      targetId: id.optional(),
      accountChoices: accountChoices.optional(),
    }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const { selection } = input;
      const posts = "postId" in selection
        ? await loadOwnPosts(input.profileId, [selection.postId])
        : (await getContentByProfile(input.profileId))
          .filter((p) => p.profileId === input.profileId && isInBudapestMonth(p.scheduledAt, selection.month))
          .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));
      if (input.targetId && input.targetId !== PROFILE_TARGET) await assertBrandInProfile(input.profileId, input.targetId);
      const store = requireStore();
      const refs = await loadRefs(input.profileId);
      return previewSend({ posts, refs, targetId: input.targetId, accountChoices: input.accountChoices }, { store });
    }),

  send: appUserProcedure
    .input(z.object({
      profileId: id,
      postIds: z.array(id).min(1).max(500),
      targetId: id,
      /** Az előnézetben megerősített Social Hub-ügyfél; ha közben más lett, nem küldünk. */
      expectedClientId: id,
      accountChoices: accountChoices.default({}),
      confirmResendIds: z.array(id).max(500).default([]),
      confirmUncertainIds: z.array(id).max(500).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const posts = await loadOwnPosts(input.profileId, input.postIds);
      if (input.targetId !== PROFILE_TARGET) await assertBrandInProfile(input.profileId, input.targetId);
      const store = requireStore();
      const refs = await loadRefs(input.profileId);
      const { postIds: _ids, ...rest } = input;
      return sendPosts({ ...rest, userId: ctx.appUser.id, posts, refs }, { store });
    }),

  repeat: appUserProcedure
    .input(z.object({ profileId: id, attemptId: id }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const store = requireStore();
      return repeatAttempt({ ...input, refs: await loadRefs(input.profileId) }, { store });
    }),
});
