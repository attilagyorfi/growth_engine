/**
 * G2A Growth Engine – Social Hub router (G2)
 *
 * connection.*: a kapcsolat kezelése, csak rendszergazdának (superAdminProcedure). A kulcs
 * soha nem megy vissza a kliensre, legfeljebb az utolsó 4 karaktere; a teljes ügyféllista is
 * csak itt látszik.
 * webhook.*: a webhook-titok kezelése, csak rendszergazdának; a titok soha nem megy vissza.
 * postStates: a posztok Social Hub-állapota a saját naplóból (assertProfileOwnership).
 * previewSend / send / repeat: a profilhoz hozzáférő felhasználónak (assertProfileOwnership).
 * A posztokat mindig a profil saját posztjai közül vesszük, így idegen poszt NOT_FOUND.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getPublicAppOrigin } from "../_core/env";
import { router, appUserProcedure, superAdminProcedure } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import { getContentByProfile, getProfileById, listProfileBrands } from "../db";
import { createSocialHubClient, getSocialHubConfig } from "../socialHub/client";
import { encryptApiKey, resolveSocialHubConfig, resolveWebhookSecret, SOCIAL_HUB_RESOLVE_ERROR } from "../socialHub/config";
import { isInBudapestMonth } from "../socialHub/drafts";
import { previewSend, repeatAttempt, sendPosts, userMessage, type SendTargetRef } from "../socialHub/send";
import { getSocialHubStore, type SocialHubStore, type StoredConnection } from "../socialHub/store";
import { assertSocialHubUrl, SocialHubUrlError } from "../socialHub/urlGuard";
import { SOCIAL_HUB_WEBHOOK_PATH } from "../socialHub/webhook";
import { listPostStates } from "../socialHub/webhookStore";
import { assertBrandInProfile } from "./brands";

export const PROFILE_TARGET = "profile";

function requireStore(): SocialHubStore {
  const store = getSocialHubStore();
  if (!store) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A Social Hubba küldés még nem érhető el." });
  return store;
}

/** A tárolóhiba eredeti szövege (SQL-paraméterek) nem kerülhet naplóba vagy válaszba. */
async function guardStorage<T>(work: () => Promise<T>, message = "A kapcsolatot most nem sikerült menteni. Próbáld újra."): Promise<T> {
  try {
    return await work();
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message });
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
  /**
   * Mutassa-e a felület a küldés gombjait: van tároló, és a kapcsolat nem hiányzik teljesen.
   * Olvashatatlan kapcsolatnál is igaz: az okot a küldő ablak írja ki.
   */
  available: appUserProcedure.query(async () => ({
    available: getSocialHubStore() !== null && (await resolveSocialHubConfig()).status !== "not_configured",
  })),

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
        await guardStorage(() => store.saveConnection({ baseUrl, apiKeyEnc, apiKeyLast4: keyLast4, updatedBy: ctx.appUser.id, envBaseUrl: getSocialHubConfig()?.baseUrl ?? null }));
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

  webhook: router({
    get: superAdminProcedure.query(async () => {
      const store = getSocialHubStore();
      const stored = store ? await store.getWebhookSecret() : null;
      // A visszafejthetetlen titokkal a fogadó sem működik, ezért az is „nincs beállítva”.
      const secretSet = stored !== null && (await resolveWebhookSecret()) !== null;
      return {
        available: store !== null,
        url: `${getPublicAppOrigin()}${SOCIAL_HUB_WEBHOOK_PATH}`,
        secretSet,
        updatedAt: secretSet ? stored.updatedAt : null,
      };
    }),

    saveSecret: superAdminProcedure
      .input(z.object({ secret: z.string().trim().regex(/^whsec_[\x21-\x7e]{16,500}$/, "Add meg a teljes titkot (whsec_ kezdetű).") }))
      .mutation(async ({ input, ctx }) => {
        const store = requireStore();
        const connected = await guardStorage(async () => (await store.getConnection()) !== null) || getSocialHubConfig() !== null;
        if (!connected) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Előbb kösd be a Social Hubot." });
        const secretEnc = encryptApiKey(input.secret);
        if (!secretEnc) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A titkot most nem tudjuk biztonságosan tárolni, ezért nem mentettük el." });
        }
        await guardStorage(() => store.saveWebhookSecret({ secretEnc, updatedBy: ctx.appUser.id }), "A titkot most nem sikerült menteni. Próbáld újra.");
        return { ok: true as const };
      }),

    deleteSecret: superAdminProcedure.mutation(async () => {
      const store = requireStore();
      await guardStorage(() => store.deleteWebhookSecret(), "A titkot most nem sikerült törölni. Próbáld újra.");
      return { ok: true as const };
    }),
  }),

  postStates: appUserProcedure
    .input(z.object({ profileId: id }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getSocialHubStore() ? listPostStates(input.profileId) : [];
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
