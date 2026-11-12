/**
 * A client_profiles.external_ref (Social Hub-párosítókulcs) bemeneti szabályai.
 * Trimelve, kisbetűsítve; az üres érték NULL (két üres érték így nem ütközik).
 * Csak [a-z0-9-], legfeljebb 64 karakter — a Social Hub példái (pl. "viba-team") ilyenek.
 */
import { z } from "zod";

export const EXTERNAL_REF_MAX_LENGTH = 64;
export const EXTERNAL_REF_FORMAT_MESSAGE =
  "A Social Hub-azonosítóban csak kisbetű, szám és kötőjel lehet, legfeljebb 64 karakter.";
export const EXTERNAL_REF_TAKEN_MESSAGE =
  "Ezt a Social Hub-azonosítót már egy másik profil használja. Adj meg másikat.";

export const externalRefInput = z
  .string()
  .max(200, EXTERNAL_REF_FORMAT_MESSAGE)
  .nullable()
  .transform((v) => {
    const trimmed = (v ?? "").trim().toLowerCase();
    return trimmed === "" ? null : trimmed;
  })
  .refine((v) => v === null || (v.length <= EXTERNAL_REF_MAX_LENGTH && /^[a-z0-9-]+$/.test(v)), {
    message: EXTERNAL_REF_FORMAT_MESSAGE,
  });
