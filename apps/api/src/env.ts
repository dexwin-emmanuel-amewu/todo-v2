import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url().default("postgres://todo:todo@localhost:5432/todo"),
});

export const env = envSchema.parse(process.env);
