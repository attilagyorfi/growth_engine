import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { EmailLayout, CtaButton, brand, APP_NAME } from "./_shared";

export interface WelcomeEmailProps {
  displayName: string;
  loginUrl: string;
}

export default function WelcomeEmail({ displayName, loginUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Üdvözlünk a ${APP_NAME} platformon, ${displayName}!`}>
      <Heading style={{ color: brand.fg, fontSize: 24, fontWeight: 700, margin: "0 0 16px", letterSpacing: "-0.5px" }}>
        Üdvözlünk, {displayName}! 🎉
      </Heading>
      <Text style={{ color: brand.fg3, fontSize: 16, lineHeight: 1.6, margin: "0 0 24px" }}>
        Sikeresen regisztráltál a {APP_NAME} platformra. Kezdd el az onboardingot, hogy az AI elkészítse a vállalkozásod Growth Engine profilját!
      </Text>
      <CtaButton href={loginUrl} label="Belépés a platformra →" />
    </EmailLayout>
  );
}
