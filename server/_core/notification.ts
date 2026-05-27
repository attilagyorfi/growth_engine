/**
 * G2A Growth Engine – Owner notification
 *
 * Korábban a Manus WebDev notification service-t hívta. Mostantól emailt
 * küld a platform owner-nek (info@g2amarketing.hu) Resend-en keresztül.
 *
 * Ha a Resend nincs konfigurálva, akkor log-and-skip — a hívó nem
 * borul fel, csak nem érkezik értesítés.
 */
import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "info@g2amarketing.hu";

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * Az owner-nek küld emailt (Resend). Visszaad `true` ha sikerült,
 * `false` ha Resend nincs konfigurálva vagy hiba történt — a hívó nem
 * crashe, csak nem érkezik értesítés.
 */
export async function notifyOwner(
  payload: NotificationPayload,
): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  // Ha Resend nincs konfigurálva (lokális dev DB nélkül stb.), csak
  // logoljuk a notification-t és visszaadjuk a false-t.
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Notification] (no Resend) Skipped owner notify: ${title}`);
    return false;
  }

  try {
    // Dinamikus import, hogy a Resend modul csak akkor töltődjön be,
    // amikor szükséges (és ne crash-eljen import-time-on ha a kulcs hiányos).
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.EMAIL_FROM || "G2A Growth Engine <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: OWNER_EMAIL,
      subject: `[G2A Growth Engine] ${title}`,
      text: content,
      html: `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap;">${
        content.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      }</p>`,
    });

    if (error) {
      console.warn(`[Notification] Resend error for owner notify:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[Notification] Failed to send owner notification:", error);
    return false;
  }
}
