import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, AppUser } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyAppToken } from "../routers/appAuth";
import { getAppUserById } from "../authDb";

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

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

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
    user,
    appUser,
  };
}
