import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().min(1),
  COMPANY_NAME: z.string().min(1),
  COMPANY_TIMEZONE: z.string().min(1),
  COMPANY_WEBSITE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().min(1),
  DEMO_MODE: z.enum(["true", "false"]).transform((value) => value === "true"),
  DATABASE_URL: z.string().min(1),
  DATABASE_AUTH_TOKEN: z.string().optional(),
});

export const env = envSchema.parse({
  APP_NAME: process.env.APP_NAME,
  COMPANY_NAME: process.env.COMPANY_NAME,
  COMPANY_TIMEZONE: process.env.COMPANY_TIMEZONE,
  COMPANY_WEBSITE_URL: process.env.COMPANY_WEBSITE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  DEMO_MODE: process.env.DEMO_MODE,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN,
});
