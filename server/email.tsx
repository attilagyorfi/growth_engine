/**
 * G2A Growth Engine – Email Helper (v2, react-email templates)
 *
 * Korábban minden email inline HTML string volt (~500 sor scope-body ismétlés,
 * design-system inkonzisztencia). Most a Resend csapatának saját
 * `react-email` csomagját használjuk (18k+ ⭐ MIT):
 *   - server/emails/*.tsx: template komponensek + shared layout
 *   - itt: a `render()` wrap + Resend send hívás
 *   - dev-time preview: `pnpm exec email dev` (későbbi PR-ben opcionálisan)
 *
 * LAZY INIT: a Resend kliens csak akkor példányosul, ha tényleg küldünk.
 * A `RESEND_API_KEY` hiányban a helper `false`-t / hiba-eredményt ad —
 * a hívó továbbmegy (graceful degradation).
 */
import * as React from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { ENV } from "./_core/env";

import WelcomeEmail from "./emails/WelcomeEmail";
import PasswordResetEmail from "./emails/PasswordResetEmail";
import AdminApprovalNeededEmail from "./emails/AdminApprovalNeededEmail";
import NewsletterEmail from "./emails/NewsletterEmail";
import PostReviewNotificationEmail from "./emails/PostReviewNotificationEmail";
import TeamInviteEmail from "./emails/TeamInviteEmail";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  if (!ENV.resendApiKey) {
    console.warn("[Email] RESEND_API_KEY nincs beállítva — email küldés letiltva (graceful skip).");
    return null;
  }
  _resend = new Resend(ENV.resendApiKey);
  return _resend;
}
const FROM_EMAIL = ENV.emailFrom || "G2A Growth Engine <onboarding@resend.dev>";
const APP_NAME = "G2A Growth Engine";

// ─── Password Reset ───────────────────────────────────────────────────────
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string | null;
  resetUrl: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const displayName = params.name || "Felhasználó";
    const html = await render(<PasswordResetEmail displayName={displayName} resetUrl={params.resetUrl} />);
    const text = await render(<PasswordResetEmail displayName={displayName} resetUrl={params.resetUrl} />, { plainText: true });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${APP_NAME} – Jelszó visszaállítás`,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return false;
  }
}

// ─── Welcome ──────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(params: {
  to: string;
  name: string | null;
  loginUrl: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const displayName = params.name || "Felhasználó";
    const html = await render(<WelcomeEmail displayName={displayName} loginUrl={params.loginUrl} />);
    const text = await render(<WelcomeEmail displayName={displayName} loginUrl={params.loginUrl} />, { plainText: true });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Üdvözlünk a ${APP_NAME}-ban! 🚀`,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Welcome email error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return false;
  }
}

// ─── Admin approval needed ───────────────────────────────────────────────
export async function sendAdminApprovalNeededEmail(params: {
  to: string;
  newUserEmail: string;
  newUserName: string | null;
  subscriptionPlan: string;
  adminUrl: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const displayName = params.newUserName || "(név nélkül)";
    const props = {
      displayName,
      newUserEmail: params.newUserEmail,
      subscriptionPlan: params.subscriptionPlan,
      adminUrl: params.adminUrl,
    };
    const html = await render(<AdminApprovalNeededEmail {...props} />);
    const text = await render(<AdminApprovalNeededEmail {...props} />, { plainText: true });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `🔔 Új regisztráció vár jóváhagyásra – ${APP_NAME}`,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Admin approval email error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return false;
  }
}

// ─── Post review notification ────────────────────────────────────────────
export async function sendPostReviewNotificationEmail(params: {
  to: string;
  name: string | null;
  postTitle: string;
  postPlatform: string;
  postPreview?: string;
  reviewUrl: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const displayName = params.name || "Felhasználó";
    const props = {
      displayName,
      postTitle: params.postTitle,
      postPlatform: params.postPlatform,
      postPreview: params.postPreview,
      reviewUrl: params.reviewUrl,
    };
    const html = await render(<PostReviewNotificationEmail {...props} />);
    const text = await render(<PostReviewNotificationEmail {...props} />, { plainText: true });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${APP_NAME} – Új poszt vár jóváhagyásra: ${params.postTitle}`,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Post review notification error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Post review unexpected error:", err);
    return false;
  }
}

// ─── Newsletter — a super_admin composer HTML body-ját wrapeli brand-frame-be
export async function sendNewsletterEmail(params: {
  to: string;
  recipientName: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const displayName = params.recipientName || "Kedves Olvasónk";
    // Leiratkozási link — mailto-fallback. Későbbi PR-ben cserélhető
    // tokenes /unsubscribe?token=... route-ra.
    const unsubscribeUrl = `mailto:${ENV.emailFrom || "info@g2amarketing.hu"}?subject=Leiratkozás%20a%20h%C3%ADrlev%C3%A9lr%C5%91l`;
    const html = await render(
      <NewsletterEmail displayName={displayName} htmlBody={params.htmlBody} unsubscribeUrl={unsubscribeUrl} />
    );
    const text = params.textBody
      ? `${displayName},\n\n${params.textBody}\n\n---\nLeiratkozás: ${unsubscribeUrl}\n– ${APP_NAME}`
      : `${displayName},\n\n[Az email teljes tartalmához HTML-támogatás szükséges.]\n\nLeiratkozás: ${unsubscribeUrl}\n\n– ${APP_NAME}`;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Newsletter send error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Newsletter unexpected error:", err);
    return false;
  }
}

// ─── Team invite — csapat-meghívó a profile tulajtól ─────────────────────
export async function sendTeamInviteEmail(params: {
  to: string;
  inviterName: string;
  profileName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresLabel: string;
}): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    const props = {
      inviterName: params.inviterName,
      profileName: params.profileName,
      roleLabel: params.roleLabel,
      acceptUrl: params.acceptUrl,
      expiresLabel: params.expiresLabel,
    };
    const html = await render(<TeamInviteEmail {...props} />);
    const text = await render(<TeamInviteEmail {...props} />, { plainText: true });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `${params.inviterName} meghívott a(z) ${params.profileName} csapatába – ${APP_NAME}`,
      html,
      text,
    });
    if (error) {
      console.error("[Email] Team invite email error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Email] Team invite unexpected error:", err);
    return false;
  }
}

// sendOutboundEmail eltávolítva — az értékesítés-modul törléskor (PR #62 /
// audit #1 spam-relay fix). Ha valaki később hívja az importot, TS build-hiba.
