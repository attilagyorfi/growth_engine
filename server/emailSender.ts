/**
 * G2A Growth Engine – Email Sender
 * Supports Gmail (SMTP) and Outlook (SMTP) via Nodemailer
 */

import nodemailer from "nodemailer";

export type EmailProvider = "gmail" | "outlook" | "smtp";

export type EmailConfig = {
  provider: EmailProvider;
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  password: string;
  fromName?: string;
};

export type SendEmailOptions = {
  config: EmailConfig;
  to: string;
  toName?: string;
  subject: string;
  body: string;
};

function createTransport(config: EmailConfig) {
  if (config.provider === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.user,
        pass: config.password, // Gmail App Password
      },
    });
  }

  if (config.provider === "outlook") {
    return nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: config.user,
        pass: config.password,
      },
      tls: { ciphers: "SSLv3" },
    });
  }

  // Generic SMTP
  return nodemailer.createTransport({
    host: config.host ?? "smtp.gmail.com",
    port: config.port ?? 587,
    secure: config.secure ?? false,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransport(options.config);

    const fromAddress = options.config.fromName
      ? `"${options.config.fromName}" <${options.config.user}>`
      : options.config.user;

    const toAddress = options.toName
      ? `"${options.toName}" <${options.to}>`
      : options.to;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      subject: options.subject,
      text: options.body,
      html: options.body.replace(/\n/g, "<br>"),
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function verifyEmailConfig(config: EmailConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createTransport(config);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
