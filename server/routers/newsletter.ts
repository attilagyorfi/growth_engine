/**
 * G2A Growth Engine – Hírlevél (newsletter) router
 *
 * Super_admin only. A regisztrációkor összegyűjtött `newsletterConsent: true`
 * feliratkozók (a leads táblában `company = "Hírlevél feliratkozó"` vagy
 * `source = "regisztráció"` sorok) kapnak tömeges emailt Resend-en át.
 *
 * MVP-szintű kampány: subject + HTML body + opcionális plain text. Egyetlen
 * azonnali küldés (nincs ütemezés). Email-szinten dedup, hogy ugyanaz a cím
 * ne kapja kétszer.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { superAdminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { leads } from "../../drizzle/schema";
import { or, eq } from "drizzle-orm";
import { sendNewsletterEmail } from "../email";

// Egyszerű késleltetés, hogy ne fussunk bele a Resend rate-limitbe (~10 req/s).
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getNewsletterSubscribers() {
  const db = await getDb();
  if (!db) return [];
  // A regisztrációkor a register mutation a leads-be ír `source: "regisztráció"`
  // sort. Tartalék: a régi/manuálisan importált címeket is olvassuk a
  // "Hírlevél feliratkozó" company alapján.
  const rows = await db
    .select({ email: leads.email, contact: leads.contact, createdAt: leads.createdAt })
    .from(leads)
    .where(or(eq(leads.source, "regisztráció"), eq(leads.company, "Hírlevél feliratkozó")));
  // Email-szintű dedup — ha ugyanaz a cím többször regisztrált, csak egyszer küldünk.
  const seen = new Map<string, { email: string; contact: string; createdAt: Date | null }>();
  for (const r of rows) {
    const key = r.email.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, { email: r.email, contact: r.contact, createdAt: r.createdAt ?? null });
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    const da = a.createdAt ? a.createdAt.getTime() : 0;
    const db_ = b.createdAt ? b.createdAt.getTime() : 0;
    return db_ - da;
  });
}

export const newsletterRouter = router({
  // Feliratkozók listája — frontend ezt használja a recipient-count chip-hez és listához.
  listSubscribers: superAdminProcedure.query(async () => {
    const subs = await getNewsletterSubscribers();
    return subs.map(s => ({
      email: s.email,
      contact: s.contact,
      createdAt: s.createdAt,
    }));
  }),

  // Kampány küldés. Throttling miatt 150ms a hívások között → ~6 req/s,
  // bőven a Resend free-tier 10 req/s limit alatt.
  sendCampaign: superAdminProcedure
    .input(z.object({
      subject: z.string().min(1, "A tárgy kötelező").max(200),
      htmlBody: z.string().min(10, "Az email tartalom túl rövid"),
      textBody: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const subs = await getNewsletterSubscribers();
      if (subs.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Nincs feliratkozó — előbb kell regisztráltaknak hírlevél-feliratkozást gyűjteni.",
        });
      }

      let sent = 0;
      let failed = 0;
      const failures: Array<{ email: string; error: string }> = [];
      for (const sub of subs) {
        try {
          const ok = await sendNewsletterEmail({
            to: sub.email,
            recipientName: sub.contact || null,
            subject: input.subject,
            htmlBody: input.htmlBody,
            textBody: input.textBody,
          });
          if (ok) {
            sent++;
          } else {
            failed++;
            failures.push({ email: sub.email, error: "Resend send returned false" });
          }
        } catch (err: any) {
          failed++;
          failures.push({ email: sub.email, error: err?.message ?? "unknown error" });
        }
        // Throttle a Resend rate-limit miatt — utolsó hívás után már nem kell várni.
        if (sub !== subs[subs.length - 1]) await sleep(150);
      }

      return {
        total: subs.length,
        sent,
        failed,
        failures: failures.slice(0, 20), // ne küldjünk vissza 1000-es failure listát
      };
    }),
});
