import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, AppUser } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyAppToken } from "../routers/appAuth";
import { getAppUserById, getOrCreateAppUserFromOAuth } from "../authDb";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  appUser: AppUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let appUser: AppUser | null = null;

  // 1. Try Manus OAuth session
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  // 2. Try app_token cookie (email+password auth)
  try {
    const cookieHeader = opts.req.headers.cookie ?? "";
    const match = cookieHeader.match(/app_token=([^;]+)/);
    if (match) {
      const payload = await verifyAppToken(match[1]);
      if (payload) {
        const found = await getAppUserById(payload.userId);
        if (found && found.active) {
          appUser = found;
        }
      }
    }
  } catch {
    appUser = null;
  }

  // 3. OAuth Bridge: if no app_token but Manus OAuth user exists,
  //    automatically find or create an appUser record for them.
  //    This allows Manus OAuth users (like the G2A admin) to use
  //    the full platform without needing a separate email/password login.
  if (!appUser && user && user.email) {
    try {
      const bridged = await getOrCreateAppUserFromOAuth({
        email: user.email,
        name: user.name ?? null,
        openId: user.openId ?? "",
      });
      if (bridged && bridged.active) {
        appUser = bridged;
      }
    } catch {
      // Bridge failure is non-fatal – appUser stays null
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    appUser,
  };
}
