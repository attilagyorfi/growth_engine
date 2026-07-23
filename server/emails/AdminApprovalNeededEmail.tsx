import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { EmailLayout, CtaButton, brand } from "./_shared";

export interface AdminApprovalNeededEmailProps {
  displayName: string;
  newUserEmail: string;
  subscriptionPlan: string;
  adminUrl: string;
}

export default function AdminApprovalNeededEmail({
  displayName, newUserEmail, subscriptionPlan, adminUrl,
}: AdminApprovalNeededEmailProps) {
  return (
    <EmailLayout
      preview="Új felhasználó vár a jóváhagyásodra."
      headerBg="linear-gradient(135deg,#f59e0b,#ef4444)"
    >
      <Heading style={{ color: brand.fg, fontSize: 22, fontWeight: 700, margin: "0 0 16px" }}>
        Új felhasználó vár jóváhagyásra
      </Heading>
      <Text style={{ color: brand.fg3, fontSize: 15, lineHeight: 1.6, margin: "0 0 20px" }}>
        Egy új felhasználó regisztrált a platformra, és a fiókja aktiválására vár:
      </Text>

      <table role="presentation" cellPadding={0} cellSpacing={0} width="100%" style={{ background: brand.bg, borderRadius: 10, padding: 16, margin: "0 0 24px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "6px 0", color: "#9ca3af", fontSize: 13, width: 120 }}>Név:</td>
            <td style={{ padding: "6px 0", color: brand.fg, fontSize: 14, fontWeight: 600 }}>{displayName}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0", color: "#9ca3af", fontSize: 13 }}>Email:</td>
            <td style={{ padding: "6px 0", color: brand.fg, fontSize: 14, fontWeight: 600 }}>{newUserEmail}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0", color: "#9ca3af", fontSize: 13 }}>Csomag:</td>
            <td style={{ padding: "6px 0", color: brand.fg, fontSize: 14, fontWeight: 600 }}>{subscriptionPlan}</td>
          </tr>
        </tbody>
      </table>

      <CtaButton href={adminUrl} label="Aktiválás az admin felületen →" />
      <Text style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.5, margin: 0, textAlign: "center" }}>
        A felhasználó addig nem tud belépni, amíg nem aktiválod a fiókot.
      </Text>
    </EmailLayout>
  );
}
