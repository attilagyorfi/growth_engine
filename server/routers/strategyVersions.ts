/**
 * G2A Growth Engine – Strategy Versions router
 *
 * Stratégia verziók CRUD + setActive + archive, teljes stratégia AI
 * generálás (executiveSummary, channelStrategy, quickWins, nextActions,
 * quarterlyGoals, monthlyPriorities), valamint a strategy_tasks tábla
 * kapcsolódó procedure-jei (generateTasks, listTasks, updateTaskStatus).
 *
 * Kivéve a `routers.ts`-ből a router-split refaktor 2. körében.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { appUserProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { assertProfileOwnership } from "../_core/ownership";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import {
  getStrategyVersionsByProfile, getActiveStrategyVersion, upsertStrategyVersion,
  setActiveStrategyVersion, archiveStrategyVersion,
  upsertStrategyTask, getStrategyTasks, getStrategyTaskById, updateStrategyTaskStatus,
} from "../db";

export const strategyVersionsRouter = router({
  list: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getStrategyVersionsByProfile(input.profileId);
    }),

  getActive: appUserProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getActiveStrategyVersion(input.profileId);
    }),

  upsert: appUserProcedure
    .input(z.object({
      id: z.string().optional(),
      profileId: z.string(),
      title: z.string().min(1),
      versionNumber: z.number().optional(),
      isActive: z.boolean().optional(),
      quarterlyGoals: z.any().optional(),
      monthlyPriorities: z.any().optional(),
      weeklySprints: z.any().optional(),
      executiveSummary: z.string().optional(),
      channelStrategy: z.any().optional(),
      campaignPriorities: z.any().optional(),
      quickWins: z.any().optional(),
      nextActions: z.any().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return upsertStrategyVersion({ ...input, id: input.id ?? nanoid() });
    }),

  setActive: appUserProcedure
    .input(z.object({ profileId: z.string(), versionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return setActiveStrategyVersion(input.profileId, input.versionId);
    }),

  archive: appUserProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => archiveStrategyVersion(input.id)),

  generate: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      intelligenceData: z.any(),
      strategyContext: z.string().optional(),
      isOnboarding: z.boolean().optional(), // bypass AI usage quota during onboarding
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      // Feature gating: check AI usage limit (bypass during onboarding)
      const usageCheck = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role, input.isOnboarding);
      if (!usageCheck.allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: `AI generálási limit elérve (${usageCheck.used}/${usageCheck.limit} ebben a hónapban). Frissítsd az előfizetésed a folytatáshoz.`, cause: { code: "AI_LIMIT_REACHED", used: usageCheck.used, limit: usageCheck.limit, plan: usageCheck.plan } });
      }
      const now = new Date();
      const currentDateStr = now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Te egy tapasztalt marketing stratéga vagy. Átfogó többszintű marketing stratégiát készísz. Kizárólag érvényes JSON-t adj vissza. MINDEN szöveges értéket KIZÁRÓLAG MAGYARUL írj meg. A mai dátum: ${currentDateStr}. A monthlyPriorities tömbnél a hónapokat a mai dátumhoz képest állítsd be (${currentYearMonth}-tól kezdve), ne használj régebbi dátumokat.` },
          { role: "user", content: `A következő vállalati intelligencia alapján (MINDEN szöveg magyarul):\n${JSON.stringify(input.intelligenceData)}\n\n${input.strategyContext ? `További kontextus: ${input.strategyContext}` : ""}\n\nGeneralj teljes stratégiát: executiveSummary (vezetői összefoglaló magyarul), channelStrategy (tömb: {channel, priority 1-5, rationale, tactics[]} - mind magyarul), campaignPriorities (string[] magyarul), quickWins (tömb: {title, description, impact, effort} - mind magyarul), nextActions (tömb: {title, description, urgency: magas/közepes/alacsony, dueDate?} - mind magyarul), quarterlyGoals ({q1?, q2?, q3?, q4?} - string[] magyarul), monthlyPriorities (tömb: {month: YYYY-MM, priorities: string[], kpis: [{label, target}]} - mind magyarul)` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "strategy_output", strict: true, schema: { type: "object", properties: { executiveSummary: { type: "string" }, channelStrategy: { type: "array", items: { type: "object", properties: { channel: { type: "string" }, priority: { type: "number" }, rationale: { type: "string" }, tactics: { type: "array", items: { type: "string" } } }, required: ["channel", "priority", "rationale", "tactics"], additionalProperties: false } }, campaignPriorities: { type: "array", items: { type: "string" } }, quickWins: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, impact: { type: "string" }, effort: { type: "string" } }, required: ["title", "description", "impact", "effort"], additionalProperties: false } }, nextActions: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, urgency: { type: "string" }, dueDate: { type: "string" } }, required: ["title", "description", "urgency"], additionalProperties: false } }, quarterlyGoals: { type: "object", properties: { q1: { type: "array", items: { type: "string" } }, q2: { type: "array", items: { type: "string" } }, q3: { type: "array", items: { type: "string" } }, q4: { type: "array", items: { type: "string" } } }, required: [], additionalProperties: false }, monthlyPriorities: { type: "array", items: { type: "object", properties: { month: { type: "string" }, priorities: { type: "array", items: { type: "string" } }, kpis: { type: "array", items: { type: "object", properties: { label: { type: "string" }, target: { type: "string" } }, required: ["label", "target"], additionalProperties: false } } }, required: ["month", "priorities", "kpis"], additionalProperties: false } } }, required: ["executiveSummary", "channelStrategy", "campaignPriorities", "quickWins", "nextActions", "quarterlyGoals", "monthlyPriorities"], additionalProperties: false } } },
      });
      const content = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      // Record AI usage (skip during onboarding)
      await recordAiUsage(ctx.appUser.id, "strategy", ctx.appUser.role, input.isOnboarding);
      const existing = await getStrategyVersionsByProfile(input.profileId);
      const versionNumber = existing.length + 1;
      return upsertStrategyVersion({
        id: nanoid(),
        profileId: input.profileId,
        title: `Stratégia v${versionNumber} – ${new Date().toLocaleDateString("hu-HU")}`,
        versionNumber,
        isActive: true,
        ...parsed,
      });
    }),

  generateTasks: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      strategyVersionId: z.string(),
      quickWins: z.array(z.any()).optional(),
      nextActions: z.array(z.any()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      const tasks: Array<{ id: string; profileId: string; strategyId: string; title: string; description?: string; funnelStage: "awareness" | "consideration" | "decision" | "retention"; status: "todo" | "in_progress" | "done" | "skipped" }> = [];
      // Convert quickWins to tasks
      for (const win of (input.quickWins ?? [])) {
        tasks.push({
          id: nanoid(),
          profileId: input.profileId,
          strategyId: input.strategyVersionId,
          title: win.title ?? "Gyors győzelem",
          description: `${win.description ?? ""} | Hatás: ${win.impact ?? ""} | Erőfeszítés: ${win.effort ?? ""}`,
          funnelStage: "awareness",
          status: "todo",
        });
      }
      // Convert nextActions to tasks
      for (const action of (input.nextActions ?? [])) {
        tasks.push({
          id: nanoid(),
          profileId: input.profileId,
          strategyId: input.strategyVersionId,
          title: action.title ?? "Következő lépés",
          description: action.description ?? "",
          funnelStage: "consideration",
          status: "todo",
        });
      }
      // Persist all tasks
      const saved = [];
      for (const task of tasks) {
        const result = await upsertStrategyTask(task);
        saved.push(result);
      }
      return { count: saved.length, tasks: saved };
    }),

  listTasks: appUserProcedure
    .input(z.object({
      profileId: z.string(),
      strategyId: z.string().optional(),
      status: z.enum(["todo", "in_progress", "done", "skipped"]).optional(),
      funnelStage: z.enum(["awareness", "consideration", "decision", "retention"]).optional(),
    }))
    .query(async ({ input, ctx }) => {
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      return getStrategyTasks(input.profileId, {
        strategyId: input.strategyId,
        status: input.status,
        funnelStage: input.funnelStage,
      });
    }),

  updateTaskStatus: appUserProcedure
    .input(z.object({
      taskId: z.string(),
      status: z.enum(["todo", "in_progress", "done", "skipped"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const task = await getStrategyTaskById(input.taskId);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "A feladat nem található" });
      await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, task.profileId, ctx.appUser.profileId);
      return updateStrategyTaskStatus(input.taskId, input.status);
    }),
});
