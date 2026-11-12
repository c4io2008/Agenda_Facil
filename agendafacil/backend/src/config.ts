import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('2h'),
  WHATSAPP_API_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_RETRY_MINUTOS: z.coerce.number().default(5),
  LEMBRETE_ANTECEDENCIA_HORAS: z.coerce.number().default(24),
  TOLERANCIA_DIAS_ATRASO: z.coerce.number().default(5),
  PAGAMENTOS_PROVIDER: z.string().default('fake'),
  PAGAMENTOS_API_KEY: z.string().default(''),
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

export function carregarEnv(fonte: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(fonte);
}
