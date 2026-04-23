/**
 * G2A Growth Engine – Email Helper
 * Resend API-val küld tranzakciós emaileket
 */
import { Resend } from "resend";
import { ENV } from "./_core/env";

const resend = new Resend(ENV.resendApiKey);
const FROM_EMAIL = ENV.emailFrom || "G2A Growth Engine <onboarding@resend.dev>";
const APP_NAME = "G2A Growth Engine";

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string | null;
  resetUrl: string;
}): Promise<boolean> {
  try {
    const { to, name, resetUrl } = params;
    const displayName = name || "Felhasználó";

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${APP_NAME} – Jelszó visszaállítás`,
      html: `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jelszó visszaállítás</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-block;line-height:40px;text-align:center;font-size:20px;">⚡</div>
                <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">${APP_NAME}</span>
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 12px;letter-spacing:-0.5px;">Jelszó visszaállítás</h1>
              <p style="color:#a1a1aa;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Szia, <strong style="color:#e4e4e7;">${displayName}</strong>!
              </p>
              <p style="color:#a1a1aa;font-size:16px;line-height:1.6;margin:0 0 32px;">
                Jelszó visszaállítási kérelmet kaptunk a fiókodhoz. Kattints az alábbi gombra az új jelszó beállításához. A link <strong style="color:#e4e4e7;">1 óráig</strong> érvényes.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;padding:1px;">
                    <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:10px;text-align:center;">
                      Jelszó visszaállítása →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback URL -->
              <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 8px;">
                Ha a gomb nem működik, másold be ezt az URL-t a böngésződbe:
              </p>
              <p style="color:#7c3aed;font-size:13px;word-break:break-all;margin:0 0 32px;">
                ${resetUrl}
              </p>
              <!-- Warning -->
              <div style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:16px;">
                <p style="color:#a1a1aa;font-size:13px;line-height:1.6;margin:0;">
                  🔒 Ha nem te kérted a jelszó visszaállítást, hagyd figyelmen kívül ezt az emailt. A fiókod biztonságban van.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#111827;padding:24px 40px;border-top:1px solid rgba(139,92,246,0.1);">
              <p style="color:#4b5563;font-size:12px;text-align:center;margin:0;">
                © ${new Date().getFullYear()} G2A Marketing – ${APP_NAME}<br>
                Ez egy automatikus email, kérjük ne válaszolj rá.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      text: `Szia ${displayName}!\n\nJelszó visszaállítási kérelmet kaptunk a fiókodhoz.\n\nKattints ide az új jelszó beállításához (1 óráig érvényes):\n${resetUrl}\n\nHa nem te kérted, hagyd figyelmen kívül ezt az emailt.\n\n– ${APP_NAME}`,
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

export async function sendWelcomeEmail(params: {
  to: string;
  name: string | null;
  loginUrl: string;
}): Promise<boolean> {
  try {
    const { to, name, loginUrl } = params;
    const displayName = name || "Felhasználó";

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Üdvözlünk a ${APP_NAME}-ban! 🚀`,
      html: `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <title>Üdvözlünk!</title>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.2);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
              <span style="color:#fff;font-size:20px;font-weight:700;">⚡ ${APP_NAME}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 16px;">Üdvözlünk, ${displayName}! 🎉</h1>
              <p style="color:#a1a1aa;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Sikeresen regisztráltál a ${APP_NAME} platformra. Kezdd el az onboardingot, hogy az AI elkészítse a vállalkozásod Growth Engine profilját!
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:10px;">
                    <a href="${loginUrl}" style="display:block;color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;text-align:center;">
                      Belépés a platformra →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#111827;padding:24px 40px;border-top:1px solid rgba(139,92,246,0.1);">
              <p style="color:#4b5563;font-size:12px;text-align:center;margin:0;">
                © ${new Date().getFullYear()} G2A Marketing – ${APP_NAME}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
      text: `Üdvözlünk ${displayName}!\n\nSikeresen regisztráltál a ${APP_NAME} platformra.\n\nBelépés: ${loginUrl}\n\n– ${APP_NAME}`,
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

/**
 * Outbound marketing email küldése Resend API-val
 * A platform Resend kulcsát használja – nincs szükség saját SMTP konfigurációra
 */
export async function sendOutboundEmail(params: {
  to: string;
  toName?: string;
  subject: string;
  body: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, toName, subject, body } = params;

    // Convert plain text body to simple HTML paragraphs
    const htmlLines = body.split("\n").map(line =>
      line.trim() === ""
        ? "<br>"
        : `<p style="margin:0 0 12px;color:#1a1a2e;font-size:15px;line-height:1.6;">${line}</p>`
    );
    const htmlBody = htmlLines.join("\n");

    const htmlTemplate = [
      "<!DOCTYPE html><html lang='hu'><head><meta charset='UTF-8'></head>",
      "<body style='margin:0;padding:0;background:#f8f8fc;font-family:Arial,sans-serif;'>",
      "<table width='100%' cellpadding='0' cellspacing='0' style='padding:32px 16px;'>",
      "<tr><td align='center'>",
      "<table width='560' cellpadding='0' cellspacing='0' style='background:#fff;border-radius:12px;border:1px solid #e5e7eb;'>",
      "<tr><td style='background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:20px 32px;'>",
      "<span style='color:#fff;font-size:16px;font-weight:700;'>G2A Growth Engine</span></td></tr>",
      "<tr><td style='padding:32px;'>",
      htmlBody,
      "</td></tr>",
      "<tr><td style='background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;'>",
      `<p style='color:#9ca3af;font-size:12px;text-align:center;margin:0;'>Ezt az emailt a G2A Growth Engine platform küldte. © ${new Date().getFullYear()} G2A Marketing</p>`,
      "</td></tr></table></td></tr></table></body></html>",
    ].join("");

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toName ? `${toName} <${to}>` : to,
      subject,
      html: htmlTemplate,
      text: body,
    });

    if (error) {
      console.error("[Email] Outbound send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ismeretlen hiba";
    console.error("[Email] Outbound unexpected error:", message);
    return { success: false, error: message };
  }
}
