import * as React from "react";
import { Text, Link, Section } from "@react-email/components";
import { EmailLayout, brand, APP_NAME } from "./_shared";

export interface NewsletterEmailProps {
  displayName: string;
  htmlBody: string;             // trusted, super_admin által composed HTML
  unsubscribeUrl: string;
}

export default function NewsletterEmail({ displayName, htmlBody, unsubscribeUrl }: NewsletterEmailProps) {
  return (
    <EmailLayout
      preview={`${APP_NAME} hírlevél`}
      footerNote={
        <>
          Ezt a hírlevelet a {APP_NAME} platformon keresztül kapod. <Link href={unsubscribeUrl} style={{ color: "#9ca3af", textDecoration: "underline" }}>Leiratkozás</Link>
        </>
      }
    >
      <Text style={{ margin: "0 0 18px", color: brand.fg3, fontSize: 14 }}>{displayName},</Text>
      {/* A super_admin által beadott HTML body — a NewsletterSection composer-jébol
          jön, ott a super_admin bizza meg magat. dangerouslySetInnerHTML az egyetlen
          modja hogy ezt beszurjuk a React tree-be. */}
      <Section
        style={{ color: brand.fg2, fontSize: 15, lineHeight: 1.65 }}
        dangerouslySetInnerHTML={{ __html: htmlBody }}
      />
    </EmailLayout>
  );
}
