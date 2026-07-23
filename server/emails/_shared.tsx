/**
 * G2A Growth Engine — Email template shared components
 *
 * A Quiet Authority design system dark-purple/indigo verziójának
 * email-optimalizált átirata. @react-email/components alapon.
 */
import * as React from "react";
import { Body, Container, Head, Html, Preview, Section, Text, Tailwind } from "@react-email/components";

// Színek — a webapp Quiet Authority palettájának email-safe verziója.
// Az OKLCH nem támogatott email kliensekben (Outlook, Gmail app), ezért hex.
export const brand = {
  bg: "#0f0f1a",
  surface: "#1a1a2e",
  border: "rgba(139,92,246,0.2)",
  gradientFrom: "#7c3aed",
  gradientTo: "#4f46e5",
  fg: "#ffffff",
  fg2: "#e4e4e7",
  fg3: "#a1a1aa",
  fg4: "#71717a",
  footerBg: "#111827",
  footerBorder: "rgba(139,92,246,0.1)",
};

export const APP_NAME = "G2A Growth Engine";

/**
 * Common email frame — header (gradient) + body slot + footer.
 * Az egyes template-ek ebbe wrapelnek.
 */
export function EmailLayout({
  preview,
  headerBg,
  children,
  footerNote,
}: {
  preview: string;
  headerBg?: string; // custom gradient (pl. warning-piros az admin-approval-hez)
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  const year = new Date().getFullYear();
  const headerStyle = headerBg
    ? { background: headerBg, padding: "32px 40px", textAlign: "center" as const }
    : { background: `linear-gradient(135deg,${brand.gradientFrom},${brand.gradientTo})`, padding: "32px 40px", textAlign: "center" as const };

  return (
    <Html lang="hu">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body style={{ margin: 0, padding: 0, background: brand.bg, fontFamily: "'Segoe UI',Arial,sans-serif" }}>
          <Container style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px" }}>
            <Section style={{ background: brand.surface, borderRadius: 16, overflow: "hidden", border: `1px solid ${brand.border}` }}>
              <Section style={headerStyle}>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
                  ⚡ {APP_NAME}
                </Text>
              </Section>
              <Section style={{ padding: 40 }}>{children}</Section>
              <Section style={{ background: brand.footerBg, padding: "24px 40px", borderTop: `1px solid ${brand.footerBorder}` }}>
                <Text style={{ color: "#4b5563", fontSize: 12, textAlign: "center", margin: 0, lineHeight: 1.5 }}>
                  © {year} G2A Marketing – {APP_NAME}
                  {footerNote ? <><br />{footerNote}</> : null}
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

/**
 * Reusable gradient-button. `href` linkkel + label szöveggel.
 * A `<a>` display:inline-block-ba burkolva, hogy Outlook is renderelje.
 */
export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "0 auto 24px" }}>
      <tbody>
        <tr>
          <td style={{ background: `linear-gradient(135deg,${brand.gradientFrom},${brand.gradientTo})`, borderRadius: 10 }}>
            <a
              href={href}
              style={{
                display: "block", color: "#fff", textDecoration: "none",
                fontSize: 15, fontWeight: 600, padding: "13px 30px", textAlign: "center",
              }}
            >
              {label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
