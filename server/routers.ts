import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { generateImage } from "./_core/imageGeneration";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // AI image generation for ContentCreator
  ai: router({
    generateImage: publicProcedure
      .input(z.object({ prompt: z.string().min(3).max(500) }))
      .mutation(async ({ input }) => {
        const result = await generateImage({ prompt: input.prompt });
        return { url: result.url ?? null };
      }),
  }),
});

export type AppRouter = typeof appRouter;
