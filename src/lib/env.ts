import { z } from "zod";

const optionalEnvironmentValue = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  APP_NAME: z.string().min(1),
  COMPANY_NAME: z.string().min(1),
  COMPANY_TIMEZONE: z.string().min(1),
  COMPANY_WEBSITE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1),
  DEMO_MODE: z.enum(["true", "false"]).transform((value) => value === "true"),
  DATABASE_URL: z.string().min(1),
  DATABASE_AUTH_TOKEN: optionalEnvironmentValue,
  BLOB_READ_WRITE_TOKEN: optionalEnvironmentValue,
  INVOICE_BLOB_READ_WRITE_TOKEN: optionalEnvironmentValue,
  OPENAI_API_KEY: optionalEnvironmentValue,
  OPENAI_MODEL: z.string().trim().min(1).default("gpt-4o"),
  VAPID_PUBLIC_KEY: optionalEnvironmentValue,
  VAPID_PRIVATE_KEY: optionalEnvironmentValue,
  VAPID_SUBJECT: optionalEnvironmentValue,
  CRON_SECRET: optionalEnvironmentValue,
});

export const env = envSchema.parse({
  APP_NAME: process.env.APP_NAME,
  COMPANY_NAME: process.env.COMPANY_NAME,
  COMPANY_TIMEZONE: process.env.COMPANY_TIMEZONE,
  COMPANY_WEBSITE_URL: process.env.COMPANY_WEBSITE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  DEMO_MODE: process.env.DEMO_MODE,
  DATABASE_URL: process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL,
  DATABASE_AUTH_TOKEN:
    process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  INVOICE_BLOB_READ_WRITE_TOKEN:
    process.env.INVOICE_BLOB_READ_WRITE_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  CRON_SECRET: process.env.CRON_SECRET,
});
