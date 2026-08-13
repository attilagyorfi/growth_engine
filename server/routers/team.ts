/**
 * G2A Growth Engine – Csapat (team invite) router
 *
 * Egy profile-tulaj (vagy super_admin) meghívhat csapattagokat egy adott
 * clientProfile-hoz, profile-szintű szereppel (owner/editor/viewer). A modul a
 * meghívó ÉLETCIKLUSÁT fedi: létrehozás + email, listázás, visszavonás.
 *
 * SCOPE: a meghívott ELFOGADÁSA (regisztráció + profile-hoz kötés + tényleges
 * jogosultság-érvényesítés) egy KÜLÖN, későbbi PR. Ez a router az invite-okat
 * `pending` státuszban hozza létre; az `accepted` átmenet oda készül elő.
 *
 * Jogosultság: minden végpont `assertProfileOwnership`-pel védett — super_admin
 * bármelyik profilhoz, sima user csak a sajátjához hívhat meg / listázhat.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { appUserProcedure, router } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import {
  getProfileById,
  getTeamInvitesByProfile,
  getTeamInviteById,
  getPendingInviteByProfileEmail,
  createTeamInvite,
  updateTeamInviteStatus,
} from "../db";
import { sendTeamInviteEmail } from "../email";
import { ENV } from "../_core/env";

// Profile-szintű szerepek — a jövőbeni jogosultság-ellenőrzés alapja.
const ROLE_LABELS: Record<"owner" | "editor" | "viewer", string> = {
  owner: "Tulajdonos",
  editor: "Szerkesztő",
  viewer: "Megtekintő",
};

// 7 napos lejárat (ms).
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function appBaseUrl(): string {
  // ENV.appUrl már trailing-slash nélkül; fallback a production Railway URL-re,
  // ugyanúgy mint az appAuth routerben.
  return ENV.appUrl || "https://growthengine-production.up.railway.app";
}

export const teamRouter = router({
  // Egy profile csapat-meghívói. A token-t SOHA nem adjuk vissza a kliensnek
  // (a meghívó-link csak emailben megy ki) — csak a megjelenítendő mezőket.
  list: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const invites = await getTeamInvitesByProfile(input.profileId);
      return invites.map(i => ({
        id: i.id,
        email: i.email,
        role: i.role,
        roleLabel: ROLE_LABELS[i.role],
        status: i.status,
        invitedByName: i.invitedByName,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      }));
    }),

  // Új meghívó. Dedup: egy (profile, email) párra egyszerre csak egy `pending`
  // meghívó lehet. Az email-küldés non-fatal — ha a Resend nincs bekötve, a
  // meghívó akkor is létrejön (a link később manuálisan is kiküldhető).
  invite: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      email: z.string().email("Érvényes email cím szükséges").max(320),
      role: z.enum(["owner", "editor", "viewer"]).default("editor"),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);

      const email = input.email.trim().toLowerCase();

      // Ne hívd meg saját magad.
      if (email === ctx.appUser.email.toLowerCase()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Magadat nem hívhatod meg — már tagja vagy a csapatnak." });
      }

      // Dedup — aktív pending meghívó ugyanarra a címre.
      const existing = await getPendingInviteByProfileEmail(input.profileId, email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Erre az email címre már van függőben lévő meghívó." });
      }

      const profile = await getProfileById(input.profileId);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "A profil nem található" });

      const id = nanoid();
      const token = nanoid(48); // 48 char ≈ 288 bit entrópia a meghívó-linkhez
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
      const inviterName = ctx.appUser.name ?? ctx.appUser.email;

      const created = await createTeamInvite({
        id,
        profileId: input.profileId,
        email,
        role: input.role,
        token,
        status: "pending",
        invitedByUserId: ctx.appUser.id,
        invitedByName: inviterName,
        expiresAt,
      });
      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A meghívó létrehozása nem sikerült" });
      }

      // Email — non-fatal. A link a jövőbeni accept-route-ra mutat (/meghivo/:token).
      const acceptUrl = `${appBaseUrl()}/meghivo/${token}`;
      let emailSent = false;
      try {
        emailSent = await sendTeamInviteEmail({
          to: email,
          inviterName,
          profileName: profile.name,
          roleLabel: ROLE_LABELS[input.role],
          acceptUrl,
          expiresLabel: "7 napig",
        });
      } catch (err) {
        console.error("[Team] Invite email send failed (non-fatal):", err);
      }

      return {
        id: created.id,
        email: created.email,
        role: created.role,
        roleLabel: ROLE_LABELS[created.role],
        status: created.status,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
        emailSent,
      };
    }),

  // Meghívó visszavonása — csak `pending` állapotból (accepted/revoked már végleges).
  revoke: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const invite = await getTeamInviteById(input.id);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "A meghívó nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, invite.profileId, ctx.appUser.profileId);

      if (invite.status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Csak függőben lévő meghívó vonható vissza." });
      }
      await updateTeamInviteStatus(input.id, "revoked");
      return { ok: true as const };
    }),
});
