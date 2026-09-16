/**
 * G2A Growth Engine – Ötletbank (#11) router.
 *
 * Tartalom-ötletek gyűjtőhelye: AI-javasolt + saját ötletek, amikből egy
 * kattintással vázlat-poszt lesz. Minden végpont profil-ownership-checkkel.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { appUserProcedure, router } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import { invokeLLM, parseLLMJson } from "../_core/llm";
import { buildBusinessContext, ANTI_GENERIC_HU } from "../_core/businessContext";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import {
  getIdeasByProfile, getIdeaById, createIdea, createIdeas, updateIdea, deleteIdea, createContent,
} from "../db";

const PLATFORMS = ["linkedin", "facebook", "instagram", "twitter", "tiktok"] as const;

export const ideasRouter = router({
  list: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getIdeasByProfile(input.profileId);
    }),

  create: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      title: z.string().min(1).max(300),
      description: z.string().max(2000).optional(),
      pillar: z.string().max(120).optional(),
      platform: z.string().max(40).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return createIdea({
        id: nanoid(),
        profileId: input.profileId,
        title: input.title,
        description: input.description ?? null,
        pillar: input.pillar ?? null,
        platform: input.platform ?? null,
        source: "user",
        status: "new",
      });
    }),

  /** AI-ötletek generálása a cég valós kontextusából (kredit-köteles). */
  generate: appUserProcedure
    .input(z.object({ profileId: z.string(), count: z.number().min(1).max(10).default(6) }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const usage = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role);
      if (!usage.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usage.used}/${usage.limit} ebben a hónapban).`, cause: { code: "AI_LIMIT_REACHED", used: usage.used, limit: usage.limit, plan: usage.plan } });
      }
      const businessContext = await buildBusinessContext(input.profileId);
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Te egy magyar közösségi média stratéga vagy. A cég valós adataira építve adj KONKRÉT, kivitelezhető tartalom-ötleteket. Mindig magyarul.\n\n${businessContext}\n\n${ANTI_GENERIC_HU}` },
          { role: "user", content: `Adj pontosan ${input.count} tartalom-ötletet a cégnek. Mindegyik legyen konkrét (nem „ossz meg egy tippet", hanem valós téma a céghez). Adj vissza JSON-t: ideas (tömb, minden elem: {title (rövid, figyelemfelkeltő cím magyarul), description (1-2 mondat, mit tartalmazna a poszt, magyarul), pillar (tartalmi pillér magyarul), platform (linkedin/facebook/instagram/twitter/tiktok közül a legjobb)})` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "content_ideas", strict: true, schema: { type: "object", properties: { ideas: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, pillar: { type: "string" }, platform: { type: "string" } }, required: ["title", "description", "pillar", "platform"], additionalProperties: false } } }, required: ["ideas"], additionalProperties: false } } },
      });
      const parsed = parseLLMJson(response.choices[0]?.message?.content ?? "{}") as { ideas?: Array<{ title: string; description?: string; pillar?: string; platform?: string }> };
      const rows = (parsed.ideas ?? []).slice(0, input.count).map((i) => ({
        id: nanoid(),
        profileId: input.profileId,
        title: String(i.title ?? "").slice(0, 300),
        description: i.description ? String(i.description).slice(0, 2000) : null,
        pillar: i.pillar ? String(i.pillar).slice(0, 120) : null,
        platform: i.platform ? String(i.platform).slice(0, 40) : null,
        source: "ai" as const,
        status: "new" as const,
      })).filter((r) => r.title.length > 0);
      await createIdeas(rows);
      await recordAiUsage(ctx.appUser.id, "other", ctx.appUser.role);
      return { created: rows.length };
    }),

  updateStatus: appUserProcedure
    .input(z.object({ id: z.string(), status: z.enum(["new", "used", "archived"]) }))
    .mutation(async ({ input, ctx }) => {
      const idea = await getIdeaById(input.id);
      if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "Az ötlet nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, idea.profileId, ctx.appUser.profileId);
      return updateIdea(input.id, { status: input.status });
    }),

  delete: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const idea = await getIdeaById(input.id);
      if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "Az ötlet nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, idea.profileId, ctx.appUser.profileId);
      await deleteIdea(input.id);
      return { ok: true };
    }),

  /** Egy ötletből vázlat-poszt: átmásolja a címet/leírást egy draft content-be,
   *  és az ötletet „used"-ra állítja. (Nem generál AI-t — a szöveg a Tartalom
   *  Studióban/AI Íróban finomítható tovább.) */
  convertToDraft: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const idea = await getIdeaById(input.id);
      if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "Az ötlet nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, idea.profileId, ctx.appUser.profileId);
      const platform = (PLATFORMS as readonly string[]).includes(idea.platform ?? "") ? (idea.platform as any) : "linkedin";
      const post = await createContent({
        id: nanoid(),
        profileId: idea.profileId,
        title: idea.title,
        platform,
        content: idea.description || idea.title,
        pillar: idea.pillar ?? undefined,
        status: "draft",
      } as any);
      await updateIdea(idea.id, { status: "used" });
      return { postId: (post as any)?.id ?? null };
    }),
});
