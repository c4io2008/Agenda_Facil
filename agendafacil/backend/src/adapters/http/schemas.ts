import { DateTime, IANAZone } from 'luxon';
import { z } from 'zod';
import { cnpjCpfValido, E164_REGEX, HHMM_REGEX, SLUG_REGEX } from '../../domain/validadores';

const uuid = z.string().uuid();
const planoEnum = z.enum(['BASICO', 'PROFISSIONAL', 'PREMIUM']);
const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD')
  .refine((v) => DateTime.fromISO(v).isValid, 'Data inválida');

const janela = z.object({
  diaSemana: z.number().int().min(0).max(6),
  inicio: z.string().regex(HHMM_REGEX, 'Use HH:mm'),
  fim: z.string().regex(HHMM_REGEX, 'Use HH:mm'),
});

const slug = z.string().regex(SLUG_REGEX, 'Use minúsculas, números e hífen (3 a 60 caracteres).');
const telefone = z.string().regex(E164_REGEX, 'Use o formato E.164, ex: +5582999990000');

export const cadastroSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  slug,
  cnpjCpf: z.string().refine(cnpjCpfValido, 'CNPJ/CPF inválido'),
  email: z.string().trim().toLowerCase().email().max(255),
  telefone: telefone.optional(),
  senha: z.string().min(8, 'A senha precisa de ao menos 8 caracteres').max(72),
  plano: planoEnum,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  senha: z.string().min(1).max(72),
});

export const slugParams = z.object({ slug: z.string().min(1).max(160) });
export const idParams = z.object({ id: uuid });
export const codigoParams = z.object({ codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/) });

export const horariosQuery = z.object({ profissionalId: uuid, servicoId: uuid, data: dataISO });

export const agendamentoSchema = z.object({
  estabelecimentoId: uuid,
  profissionalId: uuid,
  servicoId: uuid,
  nomeCliente: z.string().trim().min(3, 'Informe ao menos 3 caracteres').max(150),
  whatsappCliente: telefone,
  dataHora: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .refine((d) => d.getTime() > Date.now(), 'A data do agendamento não pode ser no passado.'),
});

export const statusSchema = z.object({ status: z.enum(['CONFIRMADO', 'CANCELADO']) });

export const estabelecimentoPatchSchema = z.object({
  nome: z.string().trim().min(2).max(150).optional(),
  slug: slug.optional(),
  telefone: telefone.nullable().optional(),
  fusoHorario: z.string().refine((v) => IANAZone.isValidZone(v), 'Fuso horário inválido').optional(),
  intervaloGradeMinutos: z.number().int().min(5).max(120).optional(),
  catalogoPublico: z.boolean().optional(),
  tituloAgenda: z.string().trim().max(60).nullable().optional(),
  tema: z.enum(['lima', 'oceano', 'rosa', 'ambar', 'claro']).optional(),
  logoUrl: z
    .string()
    .trim()
    .max(255)
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'A logo precisa ser uma URL http(s).')
    .nullable()
    .optional(),
});

export const horariosFuncionamentoSchema = z.object({ horariosFuncionamento: z.array(janela).max(50) });

const servicoBase = z.object({
  nome: z.string().trim().min(2).max(100),
  preco: z.number().min(0).max(99999.99),
  duracaoMinutos: z.number().int().min(5).max(720),
  fotoUrl: z.string().url().max(255).nullish(),
});
export const servicoSchema = servicoBase;
export const servicoPatchSchema = servicoBase.partial().extend({ ativo: z.boolean().optional() });

const profissionalBase = z.object({
  nome: z.string().trim().min(2).max(150),
  servicoIds: z.array(uuid).max(100).default([]),
  horariosAtendimento: z.array(janela).max(50).default([]),
});
export const profissionalSchema = profissionalBase;
export const profissionalPatchSchema = z.object({
  nome: profissionalBase.shape.nome.optional(),
  servicoIds: z.array(uuid).max(100).optional(),
  horariosAtendimento: z.array(janela).max(50).optional(),
  ativo: z.boolean().optional(),
});

export const agendaQuery = z.object({ inicio: dataISO, fim: dataISO, profissionalId: uuid.optional() });
export const metricasQuery = z.object({ data: dataISO.optional() });
export const mudarPlanoSchema = z.object({ plano: planoEnum });

export const plataformaListaQuery = z.object({
  status: z.enum(['ATIVO', 'SUSPENSO', 'CANCELADO']).optional(),
  plano: planoEnum.optional(),
  busca: z.string().trim().max(100).optional(),
});
export const plataformaStatusSchema = z.object({ status: z.enum(['ATIVO', 'SUSPENSO']) });
export const webhookPagamentoSchema = z.object({ referenciaExterna: z.string().min(1).max(100) });
