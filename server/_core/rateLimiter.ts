/**
 * G2A Growth Engine – Rate limiting + brute-force lockout
 *
 * Az audit medium-prio #10 fix: a `login`, `register`, `forgotPassword`,
 * `resetPassword` végpontok most nyitva állnak credential-stuffing és
 * password-guessing ellen. Ez a helper egy in-memory limiter-t ad, két
 * kulcs-dimenzióval:
 *   - IP alapú (mert egyszerre több emailt tesztelhet ugyanaz a bot)
 *   - identifier alapú (email vagy userId — mert egy jó email cím ellen
 *     több IP-ről is jöhet distributed próbálkozás)
 *
 * Kombinálva: MINDKÉT limit vizsgálva minden hívásra, az elsőnek trippelő
 * dob TRPCError-t "TOO_MANY_REQUESTS" kóddal + Retry-After metaadattal.
 *
 * Backing: in-memory (`RateLimiterMemory`). Egyetlen Railway dyno-n ez elég;
 * ha később 2+ workert használunk, cserélni kell `RateLimiterMySQL`-re
 * (a rate-limiter-flexible csomag ugyanaz az API, csak a store más).
 *
 * A kulcsokat NEM logoljuk (email-enumeráció elleni védelem).
 */
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";

/** Egy IP-t maximum 5x próbálhat bejelentkezni 15 perc alatt. */
export const loginIpLimiter = new RateLimiterMemory({
  keyPrefix: "login_ip",
  points: 5,
  duration: 15 * 60,     // 15 perc rolling window
  blockDuration: 15 * 60, // 5 fail után 15 perc lockout
});

/** Egy email cím max 5 login-kísérlet 15 perc alatt (több IP-ről is). */
export const loginEmailLimiter = new RateLimiterMemory({
  keyPrefix: "login_email",
  points: 5,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

/** Egy IP max 5 regisztráció 1 óra alatt (spam-account bot védelem). */
export const registerIpLimiter = new RateLimiterMemory({
  keyPrefix: "register_ip",
  points: 5,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

/** Egy IP max 3 password reset kérés 1 óra alatt. */
export const forgotPasswordIpLimiter = new RateLimiterMemory({
  keyPrefix: "forgot_ip",
  points: 3,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

/** Egy email cím max 3 password reset kérés 1 óra alatt. */
export const forgotPasswordEmailLimiter = new RateLimiterMemory({
  keyPrefix: "forgot_email",
  points: 3,
  duration: 60 * 60,
  blockDuration: 60 * 60,
});

/** Egy IP max 5 reset-token beváltási kísérlet 15 perc alatt. */
export const resetPasswordIpLimiter = new RateLimiterMemory({
  keyPrefix: "reset_ip",
  points: 5,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

/**
 * Kliens IP kinyerése — Railway/Vercel proxy mögött az `x-forwarded-for`
 * header első értéke a valódi kliens IP. Az express `req.ip` csak akkor
 * jó, ha `trust proxy` be van kapcsolva; a kézi parse-olás mindenhol megy.
 * Fallback: `unknown` (nem null — hogy még ha nincs IP, akkor is legyen
 * egy közös kulcs a limiterhez, ne bypass-oljunk).
 */
export function getClientIp(req: Request | undefined): string {
  if (!req) return "unknown";
  // SECURITY FIX (audit MEDIUM): a régi kód a kliens által HAMISÍTHATÓ
  // X-Forwarded-For ELSŐ elemét vette → a támadó minden kéréshez random XFF-et
  // küldve új rate-limit kulcsot kapott (IP-limiter bypass). Most az Express
  // `req.ip`-jét használjuk, ami a `trust proxy` (index.ts) beállítás miatt a
  // trusted proxy által hozzáadott, VALÓDI kliens IP — nem a hamisítható fejléc.
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * Consume + throw wrapper: ha a limit tripped, TRPCError "TOO_MANY_REQUESTS"
 * kódot dob egy magyar hibaüzenettel + a következő próba időpontjával.
 * Nem árulja el HOGY melyik limiter tripelt (IP vs email) — csak azt, hogy
 * túl sok volt a próba.
 */
export async function consumeOrThrow(
  limiter: RateLimiterMemory,
  key: string,
): Promise<void> {
  try {
    await limiter.consume(key);
  } catch (result) {
    // A rate-limiter-flexible reject-je egy RateLimiterRes objektum
    if (result instanceof RateLimiterRes || (result && typeof result === "object" && "msBeforeNext" in (result as any))) {
      const msBeforeNext = (result as RateLimiterRes).msBeforeNext ?? 60_000;
      const minutes = Math.max(1, Math.ceil(msBeforeNext / 60_000));
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Túl sok kísérlet. Kérjük, próbáld újra ${minutes} perc múlva.`,
      });
    }
    // Bármely más hiba (pl. store outage) — ne blokkolja a végpontot
    console.warn("[rateLimiter] unexpected error:", result);
  }
}
