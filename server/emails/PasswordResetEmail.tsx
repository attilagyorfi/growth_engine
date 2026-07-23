import * as React from "react";
import { Heading, Text, Section } from "@react-email/components";
import { EmailLayout, CtaButton, brand } from "./_shared";

export interface PasswordResetEmailProps {
  displayName: string;
  resetUrl: string;
}

export default function PasswordResetEmail({ displayName, resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Jelszó visszaállítási kérelem érkezett a fiókodhoz.">
      <Heading style={{ color: brand.fg, fontSize: 24, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
        Jelszó visszaállítás
      </Heading>
      <Text style={{ color: brand.fg3, fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>
        Szia, <strong style={{ color: brand.fg2 }}>{displayName}</strong>!
      </Text>
      <Text style={{ color: brand.fg3, fontSize: 16, lineHeight: 1.6, margin: "0 0 32px" }}>
        Jelszó visszaállítási kérelmet kaptunk a fiókodhoz. Kattints az alábbi gombra az új jelszó beállításához. A link{" "}
        <strong style={{ color: brand.fg2 }}>1 óráig</strong> érvényes.
      </Text>
      <CtaButton href={resetUrl} label="Jelszó visszaállítása →" />
      <Text style={{ color: brand.fg4, fontSize: 13, lineHeight: 1.6, margin: "0 0 8px" }}>
        Ha a gomb nem működik, másold be ezt az URL-t a böngésződbe:
      </Text>
      <Text style={{ color: brand.gradientFrom, fontSize: 13, wordBreak: "break-all", margin: "0 0 32px" }}>
        {resetUrl}
      </Text>
      <Section style={{ background: "rgba(139,92,246,0.1)", border: `1px solid ${brand.border}`, borderRadius: 10, padding: 16 }}>
        <Text style={{ color: brand.fg3, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          🔒 Ha nem te kérted a jelszó visszaállítást, hagyd figyelmen kívül ezt az emailt. A fiókod biztonságban van.
        </Text>
      </Section>
    </EmailLayout>
  );
}
