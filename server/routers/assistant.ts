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
import { invokeLLM } from "../_core/llm";
import { checkAiUsageLimit, recordAiUsage } from "../authDb";
import { assistantThreads, assistantMessages } from "../../drizzle/schema";

const HISTORY_LIMIT = 12;        // hány korábbi üzenet megy kontextusnak
const MAX_MESSAGE_LEN = 4000;

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
  if (profileId) {
    try {
      const { getProfileById } = await import("../db");
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
    } catch { /* kontextus nélkül is válaszolunk */ }
  }
  const pageLine = page
    ? `\n\nA felhasználó jelenleg a(z) „${page}" oldalon van — ha releváns, ehhez igazítsd a választ.`
    : "";

  return `Te a G2A Growth Engine beépített AI asszisztense vagy — egy magyar B2B marketing szoftverben segítesz a felhasználónak, aki jellemzően egy kkv-tulajdonos: NEM marketinges és NEM fejlesztő.

A stílusod: magyarul, tegeződve, közérthetően. Adj rövid, konkrét, cselekvésre kész válaszokat (bekezdés vagy felsorolás). Kerüld a szakzsargont; ha muszáj szakszót használni, magyarázd el egy mondatban.

FONTOS korlátok:
- Csak azt állítsd, amit biztosan tudsz. NE találj ki számokat, statisztikákat vagy eredményeket. Ha nincs adatod, mondd meg őszintén, és irányítsd a felhasználót, hol nézheti meg a felületen.
- Ebben a verzióban NEM tudsz magadtól műveletet végrehajtani (posztot írni/ütemezni/jóváhagyni). Ha ilyet kér, mondd el röviden, hol teheti meg (pl. „AI Író" a szövegíráshoz, „Tartalom" a jóváhagyáshoz/ütemezéshez), és ajánld fel, hogy segítesz ötlettel vagy megfogalmazással itt a chatben.
- A szoftver fő részei: Irányítópult (napi teendők, számok), Tartalom (poszt-gyártás és jóváhagyás), Stratégia, Kampányok, Cégelemzés, AI Író, Kimutatások, Weboldal check, Beállítások.${pageLine}${ctx}`;
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

      // LLM hívás
      const system = await buildSystemPrompt(input.profileId ?? null, input.page ?? null);
      let reply: string;
      try {
        const res = await invokeLLM({
          messages: [
            { role: "system", content: system },
            ...recent.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
            { role: "user", content: input.message },
          ],
          max_tokens: 1200,
        });
        const raw = res.choices?.[0]?.message?.content ?? "";
        reply = (typeof raw === "string"
          ? raw
          : Array.isArray(raw) ? raw.map((p: any) => p?.text ?? "").join("") : String(raw)
        ).trim();
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Az AI most nem válaszolt. Próbáld újra egy pillanat múlva." });
      }
      if (!reply) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Az AI üres választ adott. Fogalmazd át a kérdést, vagy próbáld újra." });
      }

      // Assistant üzenet mentése + thread frissítése + kvóta rögzítése
      await db.insert(assistantMessages).values({
        id: nanoid(), threadId: thread.id, role: "assistant", content: reply,
      });
      await db.update(assistantThreads).set({ updatedAt: new Date() }).where(eq(assistantThreads.id, thread.id));
      await recordAiUsage(ctx.appUser.id, "other", ctx.appUser.role);

      return { reply, threadId: thread.id };
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
