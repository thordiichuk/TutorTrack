import { fileURLToPath } from "node:url";

const env = process.env;
export const config = {
  port: Number(env.PORT || 3000),
  host: env.HOST || "0.0.0.0",
  databaseUrl: env.DATABASE_URL || "postgres://tutortrack:tutortrack@localhost:5432/tutortrack",
  databaseSsl: env.DATABASE_SSL === "true",
  appUrl: (env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  prod: env.NODE_ENV === "production",
  smtpUrl: env.SMTP_URL || "",
  mailFrom: env.MAIL_FROM || "TutorTrack <no-reply@tutortrack.app>",
  webDist: env.WEB_DIST || fileURLToPath(new URL("../../web/dist", import.meta.url)),
  sessionDays: 30,
};
