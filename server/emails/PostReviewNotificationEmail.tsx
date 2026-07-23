import * as React from "react";
import { Heading, Text, Section } from "@react-email/components";
import { EmailLayout, CtaButton, brand } from "./_shared";

export interface PostReviewNotificationEmailProps {
  displayName: string;
  postTitle: string;
  postPlatform: string;
  postPreview?: string;
  reviewUrl: string;
}

export default function PostReviewNotificationEmail({
  displayName, postTitle, postPlatform, postPreview, reviewUrl,
}: PostReviewNotificationEmailProps) {
  const platformLabel = postPlatform.charAt(0).toUpperCase() + postPlatform.slice(1);
  const preview = postPreview && postPreview.length > 200
    ? postPreview.slice(0, 200) + "…"
    : postPreview ?? "";

  return (
    <EmailLayout
      preview={`Új ${platformLabel} poszt vár jóváhagyásra`}
      footerNote="Ezt az értesítést a content approval workflow generálta."
    >
      <Heading style={{ color: brand.fg, fontSize: 22, fontWeight: 700, margin: "0 0 12px", letterSpacing: "-0.5px" }}>
        Új poszt vár jóváhagyásra
      </Heading>
      <Text style={{ color: brand.fg3, fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
        Szia <strong style={{ color: brand.fg2 }}>{displayName}</strong>! Egy új tartalom került review státuszba és vár a jóváhagyásodra.
      </Text>

      <Section style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 12, padding: 20, margin: "0 0 28px" }}>
        <Text style={{ display: "inline-block", background: "rgba(124,58,237,0.25)", color: "#c4b5fd", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", padding: "3px 10px", borderRadius: 999, marginBottom: 10, marginTop: 0 }}>
          {platformLabel.toUpperCase()}
        </Text>
        <Heading style={{ color: brand.fg, fontSize: 17, fontWeight: 600, margin: "0 0 10px" }}>
          {postTitle}
        </Heading>
        {preview
          ? <Text style={{ color: brand.fg3, fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{preview}</Text>
          : null}
      </Section>

      <CtaButton href={reviewUrl} label="Áttekintem és jóváhagyom →" />
    </EmailLayout>
  );
}
