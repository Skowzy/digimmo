import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  MONGO_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FRONT_ORIGIN: z.url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  MAIL_FROM: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((i) => i.path.join('.'))),
    ];
    throw new Error(`Configuration invalide : ${names.join(', ')}`);
  }
  return result.data;
}
