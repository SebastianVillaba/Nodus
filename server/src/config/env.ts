import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Cargar el archivo .env según el entorno
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

// Usar process.cwd() para obtener la raíz del proyecto (funciona en ESM y CommonJS)
const envPath = path.resolve(process.cwd(), envFile);
loadEnv({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('4001')
    .transform((val) => Number(val))
    .pipe(z.number().int().positive()),
  LOG_LEVEL: z.string().optional().default('info'),
  DB_SERVER: z.string().default('localhost'),
  DB_NAME: z.string(),
  DB_USER: z.string().optional().default(''),
  DB_PASSWORD: z.string().optional().default(''),
  // Obligatorio: sin un secreto propio cualquiera podría firmar tokens válidos.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().optional().default('12h'),
});

export const env = envSchema.parse(process.env);


