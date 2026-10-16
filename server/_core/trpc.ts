import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

// ─── Globális hibakezelő ─────────────────────────────────────────────────────
// A szándékos TRPCError-okat (validáció, CONFLICT, UNAUTHORIZED, stb.) változatlanul
// átengedi, de a belső hibákat (pl. adatbázis "Failed query") szerveroldalon
// naplózza, és a kliensnek tiszta, magyar üzenetet ad — SOHA nem nyers SQL-t.
// (UX + biztonság: a DB szerkezete nem szivároghat ki a felhasználóhoz.)
const sanitizeErrors = t.middleware(async ({ next, path }) => {
  const result = await next();
  if (!result.ok && result.error.code === "INTERNAL_SERVER_ERROR") {
    const err = result.error;
    console.error(
      `[tRPC] Belső hiba a(z) "${path}" végponton:`,
      err.cause instanceof Error ? err.cause.message : err.message,
    );
    if (err.cause instanceof Error && err.cause.stack) {
      console.error(err.cause.stack);
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Váratlan hiba történt. Kérlek próbáld újra később.",
    });
  }
  return result;
});

// Minden procedure ebből származik → mindenhol érvényes a hibatisztítás.
const baseProcedure = t.procedure.use(sanitizeErrors);
export const publicProcedure = baseProcedure;

// ─── App Auth (email+password) protected procedure ────────────────────────────
const requireAppUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.appUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Bejelentkezés szükséges" });
  }
  return next({ ctx: { ...ctx, appUser: ctx.appUser } });
});

export const appUserProcedure = baseProcedure.use(requireAppUser);

// ─── Super Admin procedure ────────────────────────────────────────────────────
export const superAdminProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.appUser || ctx.appUser.role !== 'super_admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Rendszergazdai jogosultság szükséges" });
    }
    return next({ ctx: { ...ctx, appUser: ctx.appUser } });
  }),
);
