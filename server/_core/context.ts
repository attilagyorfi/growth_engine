import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { AppUser } from "../../drizzle/schema";
import { verifyAppToken } from "../routers/appAuth";
import { getAppUserById } from "../authDb";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  appUser: AppUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let appUser: AppUser | null = null;

  // Bejelentkezés: az app_token süti (email + jelszó).
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

  return {
    req: opts.req,
    res: opts.res,
    appUser,
  };
}
