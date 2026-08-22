/**
 * G2A Growth Engine – AI Copilot (asszisztens) router — Fázis 1
 *
 * Kontextus-tudatos, READ-ONLY chat: válaszol, magyaráz, javasol — de ebben a
 * fázisban NEM hajt végre műveletet (posztírás/ütemezés/jóváhagyás = Fázis 2,
 * tool-calling + megerősítés). Egy folyamatos thread / (appUser + profil).
 *
 * Biztonság: profil-scoped kérésnél kötelező ownership-check. Kvóta: minden
 * válasz a havi AI-keretbe számít (total-cap + recordAiUsage "other").
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, asc, desc } from "drizzle-orm";
import { appUserProcedure, router } from "../_core/trpc";
import { assertProfileOwnership } from "../_core/ownership";
import { invokeLLM, type Tool } from "../_core/llm";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import { assistantThreads, assistantMessages } from "../../drizzle/schema";

const HISTORY_LIMIT = 12;        // hány korábbi üzenet megy kontextusnak
const MAX_MESSAGE_LEN = 4000;
const PLATFORMS = ["linkedin", "facebook", "instagram", "twitter", "tiktok"] as const;

// Fázis 2 — tool-calling. FONTOS: a tool-hívás NEM fut le automatikusan; a
// szerver JAVASLATTÁ alakítja, a kliens megerősítő kártyát mutat, és csak a
// felhasználó jóváhagyása után az `executeAction` hajtja végre (ownership +
// státusz-őrökkel). Így a „csináld meg helyettem" élmény biztonságos marad.
const ASSISTANT_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "draft_post",
      description: "Új közösségi média poszt VÁZLAT elkészítése és mentése. Akkor hívd, ha a felhasználó azt kéri, írj/készíts neki egy posztot. Vázlatként mentődik — a felhasználó később átnézi, jóváhagyja, ütemezi.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: [...PLATFORMS], description: "A cél platform." },
          title: { type: "string", description: "Rövid belső cím a poszthoz (nem publikus)." },
          content: { type: "string", description: "A poszt teljes szövege magyarul, a platformnak megfelelő stílusban." },
          hashtags: { type: "array", items: { type: "string" }, description: "Releváns hashtagek, # nélkül." },
          pillar: { type: "string", description: "Tartalmi pillér, ha releváns." },
        },
        required: ["platform", "title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_post",
      description: "Egy jóváhagyásra váró (review) poszt jóváhagyása. KIZÁRÓLAG a kontextusban jóváhagyásra vár-ként felsorolt posztokra hívható, a pontos postId-vel.",
      parameters: {
        type: "object",
        properties: {
          postId: { type: "string", description: "A jóváhagyandó poszt azonosítója a kontextus-listából." },
          title: { type: "string", description: "A poszt címe (megjelenítéshez)." },
        },
        required: ["postId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_post",
      description: "Egy már JÓVÁHAGYOTT (approved) poszt ütemezése. KIZÁRÓLAG a kontextusban jóváhagyott-ként felsorolt posztokra hívható.",
      parameters: {
        type: "object",
        properties: {
          postId: { type: "string", description: "Az ütemezendő poszt azonosítója a kontextus-listából." },
          scheduledAt: { type: "string", description: "ISO 8601 dátum-idő (pl. 2026-08-25T10:00), amikor a poszt kimenjen." },
          title: { type: "string", description: "A poszt címe (megjelenítéshez)." },
        },
        required: ["postId", "scheduledAt"],
      },
    },
  },
];

type ProposedAction = { type: "draft_post" | "approve_post" | "schedule_post"; params: Record<string, any>; summary: string };

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", twitter: "X", tiktok: "TikTok",
};

/** LLM tool-hívásból ember-olvasható javaslat (megerősítő kártyához). Érvénytelen args → null. */
function buildProposal(name: string, args: any): ProposedAction | null {
  try {
    if (name === "draft_post") {
      if (!args?.platform || !args?.content || !PLATFORMS.includes(args.platform)) return null;
      const title = String(args.title || "Új poszt");
      return { type: "draft_post", params: args, summary: `Vázlat mentése: „${title}" — ${PLATFORM_LABEL[args.platform] ?? args.platform} poszt` };
    }
    if (name === "approve_post") {
      if (!args?.postId) return null;
      return { type: "approve_post", params: args, summary: `Poszt jóváhagyása: „${args.title || args.postId}"` };
    }
    if (name === "schedule_post") {
      if (!args?.postId || !args?.scheduledAt) return null;
      const d = new Date(args.scheduledAt);
      const when = Number.isNaN(d.getTime()) ? String(args.scheduledAt) : d.toLocaleString("hu-HU", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
      return { type: "schedule_post", params: args, summary: `Poszt ütemezése: „${args.title || args.postId}" — ${when}` };
    }
  } catch { /* fall through */ }
  return null;
}

async function requireDb() {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Az adatbázis most nem elérhető." });
  return db;
}

/** A user aktív threadje az adott profil-kontextusban (vagy null). */
async function findThread(db: any, appUserId: string, profileId: string | null) {
  const cond = profileId
    ? and(eq(assistantThreads.appUserId, appUserId), eq(assistantThreads.profileId, profileId))
    : and(eq(assistantThreads.appUserId, appUserId), isNull(assistantThreads.profileId));
  const [row] = await db.select().from(assistantThreads).where(cond).orderBy(desc(assistantThreads.updatedAt)).limit(1);
  return row ?? null;
}

async function buildSystemPrompt(profileId: string | null, page: string | null): Promise<string> {
  let ctx = "";
  let actionsCtx = "";
  if (profileId) {
    try {
      const { getProfileById, getContentByProfile } = await import("../db");
      const p: any = await getProfileById(profileId);
      if (p) {
        const bits: string[] = [];
        if (p.name) bits.push(`Cég: ${p.name}`);
        if (p.industry) bits.push(`Iparág: ${p.industry}`);
        if (p.description) bits.push(`Leírás: ${String(p.description).slice(0, 400)}`);
        if (p.brandVoice?.tone) bits.push(`Márka hangnem: ${p.brandVoice.tone}${p.brandVoice.style ? `, ${p.brandVoice.style}` : ""}`);
        if (Array.isArray(p.contentPillars) && p.contentPillars.length) {
          bits.push(`Tartalmi pillérek: ${p.contentPillars.map((x: any) => x?.name).filter(Boolean).slice(0, 6).join(", ")}`);
        }
        if (bits.length) ctx = `\n\nAmit az ügyfélről tudsz (használd, ha releváns):\n- ${bits.join("\n- ")}`;
      }
      // Művelethető posztok — az approve_post/schedule_post CSAK ezekre hívható.
      const posts: any[] = await getContentByProfile(profileId);
      const lines: string[] = [];
      for (const x of posts.filter((x) => x.status === "review").slice(0, 8)) {
        lines.push(`- [${x.id}] „${x.title}" (${PLATFORM_LABEL[x.platform] ?? x.platform}) — JÓVÁHAGYÁSRA VÁR`);
      }
      for (const x of posts.filter((x) => x.status === "approved").slice(0, 8)) {
        lines.push(`- [${x.id}] „${x.title}" (${PLATFORM_LABEL[x.platform] ?? x.platform}) — JÓVÁHAGYVA, ütemezhető`);
      }
      if (lines.length) {
        actionsCtx = `\n\nMűvelethető posztok (a postId a szögletes zárójelben — approve_post/schedule_post KIZÁRÓLAG ezekre hívható):\n${lines.join("\n")}`;
      }
    } catch { /* kontextus nélkül is válaszolunk */ }
  }
  const pageLine = page
    ? `\n\nA felhasználó jelenleg a(z) „${page}" oldalon van — ha releváns, ehhez igazítsd a választ.`
    : "";

  return `Te a G2A Growth Engine beépített AI asszisztense vagy — egy magyar B2B marketing szoftverben segítesz a felhasználónak, aki jellemzően egy kkv-tulajdonos: NEM marketinges és NEM fejlesztő.

A stílusod: magyarul, tegeződve, közérthetően. Adj rövid, konkrét, cselekvésre kész válaszokat (bekezdés vagy felsorolás). Kerüld a szakzsargont; ha muszáj szakszót használni, magyarázd el egy mondatban.

Amit MEG TUDSZ tenni (mindig a felhasználó megerősítésével — a rendszer megerősítő kártyát mutat, és a művelet CSAK jóváhagyás után hajtódik végre):
- draft_post: posztot írsz és VÁZLATKÉNT elmented.
- approve_post: jóváhagyásra váró posztot hagysz jóvá — kizárólag a lenti listából, a pontos postId-vel.
- schedule_post: már jóváhagyott posztot ütemezel — kizárólag a lenti listából.
Ha a felhasználó ilyet kér, hívd a megfelelő tool-t a pontos paraméterekkel. Ne állítsd, hogy „kész" vagy „elküldtem" — a tényleges művelet csak a megerősítés után történik meg; te javaslatot teszel. Ha a listában nincs megfelelő poszt az approve/schedule-hoz, mondd el, és ajánld fel, hogy írsz egy új vázlatot.

FONTOS korlátok:
- Csak azt állítsd, amit biztosan tudsz. NE találj ki számokat, statisztikákat vagy eredményeket. Ha nincs adatod, mondd meg őszintén, és irányítsd a felhasználót, hol nézheti meg a felületen.
- Publikálni (azonnal élesíteni) nem tudsz — csak vázlat, jóváhagyás és ütemezés érhető el.
- A szoftver fő részei: Irányítópult (napi teendők, számok), Tartalom (poszt-gyártás és jóváhagyás), Stratégia, Kampányok, Cégelemzés, AI Író, Kimutatások, Weboldal check, Beállítások.${pageLine}${ctx}${actionsCtx}`;
}

export const assistantRouter = router({
  /** Az aktív thread üzenetei (növekvő időrendben). */
  getMessages: appUserProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      if (input.profileId) {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      }
      const db = await requireDb();
      const thread = await findThread(db, ctx.appUser.id, input.profileId ?? null);
      if (!thread) return [];
      const msgs = await db.select().from(assistantMessages)
        .where(eq(assistantMessages.threadId, thread.id))
        .orderBy(asc(assistantMessages.createdAt));
      return msgs.map((m: any) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content, createdAt: m.createdAt }));
    }),

  /** Üzenet küldése → LLM válasz (nem streaming, Fázis 1). */
  send: appUserProcedure
    .input(z.object({
      message: z.string().trim().min(1).max(MAX_MESSAGE_LEN),
      page: z.string().max(128).optional(),
      profileId: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.profileId) {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      }

      // Kvóta: minden válasz a havi keretbe számít (total-cap, per-feature 0-gate nélkül).
      const usage = await checkAiUsageLimit(ctx.appUser.id, ctx.appUser.subscriptionPlan ?? "free", ctx.appUser.role);
      if (!usage.allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Elérted a havi AI-kereted (${usage.used}/${usage.limit}). Frissítsd a csomagot a folytatáshoz.`,
          cause: { code: "AI_LIMIT_REACHED", used: usage.used, limit: usage.limit, plan: usage.plan },
        });
      }

      const db = await requireDb();

      // Thread lekérése / létrehozása
      let thread = await findThread(db, ctx.appUser.id, input.profileId ?? null);
      if (!thread) {
        const id = nanoid();
        await db.insert(assistantThreads).values({ id, appUserId: ctx.appUser.id, profileId: input.profileId ?? null });
        thread = { id };
      }

      // Előzmény (utolsó N, növekvő időrendben)
      const recent = await db.select().from(assistantMessages)
        .where(eq(assistantMessages.threadId, thread.id))
        .orderBy(desc(assistantMessages.createdAt))
        .limit(HISTORY_LIMIT);
      recent.reverse();

      // User üzenet mentése
      await db.insert(assistantMessages).values({
        id: nanoid(), threadId: thread.id, role: "user", content: input.message, page: input.page ?? null,
      });

      // LLM hívás — a tool-ok elérhetők, de a tool-hívás JAVASLAT lesz (nem fut le).
      const system = await buildSystemPrompt(input.profileId ?? null, input.page ?? null);
      let reply = "";
      let proposedAction: ProposedAction | null = null;
      try {
        const res = await invokeLLM({
          messages: [
            { role: "system", content: system },
            ...recent.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "user", content: input.message },
          ],
          tools: ASSISTANT_TOOLS,
          toolChoice: "auto",
          max_tokens: 1200,
        });
        const msg: any = res.choices?.[0]?.message;
        const raw = msg?.content ?? "";
        reply = (typeof raw === "string"
          ? raw
          : Array.isArray(raw) ? raw.map((p: any) => p?.text ?? "").join("") : String(raw)
        ).trim();
        const call = msg?.tool_calls?.[0];
        if (call?.function?.name) {
          let args: any = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }
          proposedAction = buildProposal(call.function.name, args);
        }
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Az AI most nem válaszolt. Próbáld újra egy pillanat múlva." });
      }
      // Ha van javaslat, de a modell nem írt kísérőszöveget, adjunk egy rövidet.
      if (proposedAction && !reply) {
        reply = "Készítettem egy javaslatot — nézd át, és ha jó, erősítsd meg.";
      }
      if (!reply && !proposedAction) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Az AI üres választ adott. Fogalmazd át a kérdést, vagy próbáld újra." });
      }

      // Assistant üzenet mentése (a javaslat efemer — megerősítésig nem perzisztáljuk).
      await db.insert(assistantMessages).values({
        id: nanoid(), threadId: thread.id, role: "assistant", content: reply,
      });
      await db.update(assistantThreads).set({ updatedAt: new Date() }).where(eq(assistantThreads.id, thread.id));
      await recordAiUsage(ctx.appUser.id, "other", ctx.appUser.role);

      return { reply, threadId: thread.id, proposedAction };
    }),

  /** Egy megerősített javaslat VÉGREHAJTÁSA (csak felhasználói jóváhagyás után hívja a kliens). */
  executeAction: appUserProcedure
    .input(z.object({
      profileId: z.string().optional(),
      action: z.object({
        type: z.enum(["draft_post", "approve_post", "schedule_post"]),
        params: z.record(z.string(), z.any()),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.profileId) {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      }
      const { type, params } = input.action;
      const { createContent, getContentById, updateContent } = await import("../db");

      if (type === "draft_post") {
        if (!input.profileId) throw new TRPCError({ code: "BAD_REQUEST", message: "Nincs kiválasztott ügyfél a mentéshez." });
        const platform = String(params.platform);
        if (!PLATFORMS.includes(platform as any)) throw new TRPCError({ code: "BAD_REQUEST", message: "Ismeretlen platform." });
        const content = String(params.content ?? "").trim();
        if (!content) throw new TRPCError({ code: "BAD_REQUEST", message: "A poszt szövege üres." });
        const title = String(params.title || "Új poszt").slice(0, 200);
        const hashtags = Array.isArray(params.hashtags) ? params.hashtags.map((h: any) => String(h)).slice(0, 30) : undefined;
        await createContent({
          id: nanoid(),
          profileId: input.profileId,
          title,
          platform: platform as any,
          content,
          hashtags,
          pillar: params.pillar ? String(params.pillar) : undefined,
          status: "draft",
        } as any);
        return { ok: true, message: `Elmentettem vázlatként: „${title}" (${PLATFORM_LABEL[platform] ?? platform}). A Tartalom oldalon átnézheted és ütemezheted.` };
      }

      if (type === "approve_post") {
        const post: any = await getContentById(String(params.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "A poszt nem található." });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        if (post.status !== "review") throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyásra váró poszt hagyható jóvá." });
        await updateContent(post.id, { status: "approved", reviewedBy: ctx.appUser.id, reviewedAt: new Date() } as any);
        return { ok: true, message: `Jóváhagytam: „${post.title}". Most már ütemezhető.` };
      }

      if (type === "schedule_post") {
        const post: any = await getContentById(String(params.postId));
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "A poszt nem található." });
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, post.profileId, ctx.appUser.profileId);
        if (post.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Csak jóváhagyott poszt ütemezhető." });
        const when = new Date(String(params.scheduledAt));
        if (Number.isNaN(when.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "Érvénytelen időpont." });
        await updateContent(post.id, { status: "scheduled", scheduledAt: when } as any);
        return { ok: true, message: `Beütemeztem: „${post.title}" — ${when.toLocaleString("hu-HU", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}.` };
      }

      throw new TRPCError({ code: "BAD_REQUEST", message: "Ismeretlen művelet." });
    }),

  /** A beszélgetés törlése (új lappal indul). */
  clear: appUserProcedure
    .input(z.object({ profileId: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (input.profileId) {
        await assertProfileOwnership(ctx.appUser.id, ctx.appUser.role, input.profileId, ctx.appUser.profileId);
      }
      const db = await requireDb();
      const thread = await findThread(db, ctx.appUser.id, input.profileId ?? null);
      if (thread) {
        await db.delete(assistantMessages).where(eq(assistantMessages.threadId, thread.id));
      }
      return { ok: true };
    }),
});
