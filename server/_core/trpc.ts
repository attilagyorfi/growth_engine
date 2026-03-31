import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// ─── Manus OAuth protected procedure ─────────────────────────────────────────
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

// ─── App Auth (email+password) protected procedure ────────────────────────────
const requireAppUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.appUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Bejelentkezés szükséges" });
  }
  return next({ ctx: { ...ctx, appUser: ctx.appUser } });
});

export const appUserProcedure = t.procedure.use(requireAppUser);

// ─── Super Admin procedure ────────────────────────────────────────────────────
export const superAdminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.appUser || ctx.appUser.role !== 'super_admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: "Rendszergazdai jogosultság szükséges" });
    }
    return next({ ctx: { ...ctx, appUser: ctx.appUser } });
  }),
);
