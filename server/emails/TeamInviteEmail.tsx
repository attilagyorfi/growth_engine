import * as React from "react";
import { Heading, Text, Section } from "@react-email/components";
import { EmailLayout, CtaButton, brand, APP_NAME } from "./_shared";

export interface TeamInviteEmailProps {
  inviterName: string;
  profileName: string;
  roleLabel: string;
  acceptUrl: string;
  expiresLabel: string;
}

/**
 * Csapat-meghívó email. Egy super_admin / profile-tulaj hív meg valakit egy
 * adott Growth Engine profilhoz, profile-szintű szereppel (Tulajdonos/Szerkesztő/
 * Megtekintő). A gomb a token-es accept-linkre mutat (accept-flow: későbbi PR).
 */
export default function TeamInviteEmail({
  inviterName,
  profileName,
  roleLabel,
  acceptUrl,
  expiresLabel,
}: TeamInviteEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} meghívott a(z) ${profileName} csapatába`}
      footerNote="Ha nem számítottál erre a meghívóra, nyugodtan hagyd figyelmen kívül ezt az emailt."
    >
      <Heading style={{ color: brand.fg, fontSize: 24, fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.5px" }}>
        Meghívást kaptál egy csapatba 🤝
      </Heading>
      <Text style={{ color: brand.fg3, fontSize: 16, lineHeight: 1.6, margin: "0 0 20px" }}>
        <strong style={{ color: brand.fg2 }}>{inviterName}</strong> meghívott, hogy csatlakozz a(z){" "}
        <strong style={{ color: brand.fg2 }}>{profileName}</strong> csapatához a {APP_NAME} platformon.
      </Text>

      <Section
        style={{
          background: brand.bg,
          border: `1px solid ${brand.border}`,
          borderRadius: 10,
          padding: "16px 20px",
          margin: "0 0 24px",
        }}
      >
        <Text style={{ color: brand.fg4, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 4px" }}>
          Szereped a csapatban
        </Text>
        <Text style={{ color: brand.fg, fontSize: 16, fontWeight: 600, margin: 0 }}>
          {roleLabel}
        </Text>
      </Section>

      <CtaButton href={acceptUrl} label="Meghívó elfogadása →" />

      <Text style={{ color: brand.fg4, fontSize: 13, lineHeight: 1.5, margin: "8px 0 0", textAlign: "center" }}>
        A meghívó {expiresLabel} érvényes.
      </Text>
    </EmailLayout>
  );
}
