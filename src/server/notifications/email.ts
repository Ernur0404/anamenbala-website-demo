import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const url = env().SMTP_URL;
  if (!url) return null;
  transporter ??= nodemailer.createTransport(url);
  return transporter;
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }) {
  const transport = getTransporter();
  if (!transport) {
    // SMTP не настроен (разработка) — письмо пишется в лог
    console.info(`[email → ${message.to}] ${message.subject}\n${message.text}`);
    return;
  }
  await transport.sendMail({ from: env().MAIL_FROM, ...message });
}
