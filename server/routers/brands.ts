/**
 * G2A Growth Engine – Márkák (alárkák) router (G1, 0025)
 *
 * Az ügyfél EGY profil marad; a márkák a profilon belüli címkék (pl. Dr K Phillips
 * klinika + termék). Egy márka a Social Hubban külön ügyfél is lehet: ilyenkor a
 * socialHubExternalRef párosít (ugyanaz a validáció, mint a profil external_ref-jénél,
 * és nem ütközhet sem másik márkáéval, sem bármely profiléval).
 *
 * Mindenhol assertProfileOwnership; a márkára mindig profileId + brandId párral
 * hivatkozunk, így más profil márkája NOT_FOUND.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, appUserProcedure } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import {
  listProfileBrands,
  getProfileBrand,
  createProfileBrand,
  updateProfileBrand,
  deleteProfileBrand,
  type BrandWriteResult,
} from "../db";
import { externalRefInput, EXTERNAL_REF_TAKEN_MESSAGE } from "../socialHub/externalRef";

export const BRAND_NOT_FOUND_MESSAGE = "A márka nem található.";
export const BRAND_NAME_TAKEN_MESSAGE = "Ilyen nevű márka már van ennél az ügyfélnél. Adj meg másikat.";
export const BRAND_HAS_CONNECTIONS_MESSAGE =
  "Ehhez a márkához még kapcsolat tartozik. Előbb vedd le a márkát a kapcsolatokról.";

export const brandNameInput = z
  .string()
  .trim()
  .min(1, "Adj nevet a márkának.")
  .max(120, "A márka neve legfeljebb 120 karakter lehet.");

/**
 * A brandId az adott profilé-e? Ha nem (vagy nem létezik), NOT_FOUND — más profil
 * márkájáról így semmit nem árulunk el. A hívó előbb assertProfileOwnership-et hív.
 */
export async function assertBrandInProfile(profileId: string, brandId: string) {
  const brand = await getProfileBrand(profileId, brandId);
  if (!brand) throw new TRPCError({ code: "NOT_FOUND", message: BRAND_NOT_FOUND_MESSAGE });
  return brand;
}

function unwrapBrandWrite(result: BrandWriteResult) {
  if (result.ok) return result.brand;
  if (result.reason === "name_taken") throw new TRPCError({ code: "CONFLICT", message: BRAND_NAME_TAKEN_MESSAGE });
  if (result.reason === "ref_taken") throw new TRPCError({ code: "CONFLICT", message: EXTERNAL_REF_TAKEN_MESSAGE });
  throw new TRPCError({ code: "NOT_FOUND", message: BRAND_NOT_FOUND_MESSAGE });
}

export const brandsRouter = router({
  list: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return listProfileBrands(input.profileId);
    }),

  create: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      name: brandNameInput,
      socialHubExternalRef: externalRefInput.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return unwrapBrandWrite(await createProfileBrand(input.profileId, {
        name: input.name,
        socialHubExternalRef: input.socialHubExternalRef ?? null,
      }));
    }),

  update: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      brandId: z.string(),
      name: brandNameInput.optional(),
      // undefined = nem változik; üres/null = a párosítás törlése.
      socialHubExternalRef: externalRefInput.optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      await assertBrandInProfile(input.profileId, input.brandId);
      const patch: { name?: string; socialHubExternalRef?: string | null } = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.socialHubExternalRef !== undefined) patch.socialHubExternalRef = input.socialHubExternalRef;
      return unwrapBrandWrite(await updateProfileBrand(input.profileId, input.brandId, patch));
    }),

  // Kapcsolattal rendelkező márka nem törölhető (CONFLICT). Különben a márka
  // metrikasorai vele együtt törlődnek; az elkészült riportok megmaradnak.
  delete: appUserProcedure
    .input(z.object({ profileId: z.string(), brandId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const result = await deleteProfileBrand(input.profileId, input.brandId);
      if (result.ok) return { ok: true as const };
      if (result.reason === "has_connections") {
        throw new TRPCError({ code: "CONFLICT", message: BRAND_HAS_CONNECTIONS_MESSAGE });
      }
      throw new TRPCError({ code: "NOT_FOUND", message: BRAND_NOT_FOUND_MESSAGE });
    }),
});
