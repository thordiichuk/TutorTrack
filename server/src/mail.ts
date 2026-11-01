import nodemailer from "nodemailer";
import { config } from "./config.js";

const transport = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;

/** Sends an e-mail when SMTP is configured. Returns false (and logs) when it is not. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!transport) {
    console.log(`[mail] SMTP_URL not set – e-mail to ${to} not sent.\nSubject: ${subject}\n${text}`);
    return false;
  }
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
  return true;
}
