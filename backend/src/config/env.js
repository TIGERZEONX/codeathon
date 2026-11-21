import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().default('mongodb://localhost:27017/codeathon'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().default('codeathon_access_secret_development_key_default'),
  JWT_REFRESH_SECRET: z.string().default('codeathon_refresh_secret_development_key_default'),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),
  JUDGE0_URL: z.string().default('http://localhost:2358'),
  JUDGE0_AUTH_TOKEN: z.string().optional().default(''),
  SUPER_ADMIN_EMAIL: z.string().default('superadmin@codeathon.dev'),
  SUPER_ADMIN_PASSWORD: z.string().default('SuperAdmin@2026!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
