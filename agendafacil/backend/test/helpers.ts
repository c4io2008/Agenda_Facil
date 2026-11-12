import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';
import request from 'supertest';
import { criarApp } from '../src/adapters/http/app';
import { carregarEnv } from '../src/config';
import type { Relogio } from '../src/application/ports';
import { criarContainer } from '../src/infrastructure/container';
import { ProvedorPagamentoFake } from '../src/infrastructure/pagamentos/provedores';
import { WhatsAppFake } from '../src/infrastructure/whatsapp/clientes';

/** Relógio real com deslocamento: permite "avançar o tempo" sem quebrar validações baseadas em Date.now(). */
export class RelogioTeste implements Relogio {
  private offsetMs = 0;
  agora() {
    return new Date(Date.now() + this.offsetMs);
  }
  avancar(ms: number) {
    this.offsetMs += ms;
  }
}

export const MINUTO = 60_000;
export const DIA = 86_400_000;

export function criarAmbiente() {
  const env = carregarEnv(process.env);
  const prisma = new PrismaClient();
  const relogio = new RelogioTeste();
  const whatsapp = new WhatsAppFake();
  const pagamentos = new ProvedorPagamentoFake();
  const container = criarContainer(env, { prisma, relogio, whatsapp, pagamentos });
  const app = criarApp(container);
  return { env, prisma, relogio, whatsapp, pagamentos, container, app };
}
export type Ambiente = ReturnType<typeof criarAmbiente>;

export async function limparBanco(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE notificacoes_whatsapp, agendamentos, profissionais_servicos, horarios_atendimento,
      profissionais, servicos, horarios_funcionamento, cobrancas, assinaturas, auditoria_plataforma,
      usuarios_plataforma, estabelecimentos RESTART IDENTITY CASCADE`,
  );
}

let contador = 0;
function digitoCpf(base: number[]) {
  const soma = base.reduce((acc, n, i) => acc + n * (base.length + 1 - i), 0);
  const r = (soma * 10) % 11;
  return r === 10 ? 0 : r;
}
/** CPF válido e único por chamada. */
export function gerarCpf(): string {
  contador++;
  const base = String(100_000_000 + contador * 7919)
    .padStart(9, '0')
    .slice(0, 9)
    .split('')
    .map(Number);
  const d1 = digitoCpf(base);
  const d2 = digitoCpf([...base, d1]);
  return [...base, d1, d2].join('');
}

/** Data/hora futura (UTC ISO) no fuso America/Maceio. */
export function horarioFuturo(diasAFrente = 3, hora = 14, minuto = 0): string {
  return DateTime.now()
    .setZone('America/Maceio')
    .plus({ days: diasAFrente })
    .set({ hour: hora, minute: minuto, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()!;
}

export interface Tenant {
  token: string;
  estabelecimentoId: string;
  slug: string;
  profissionalId: string;
  servicoId: string;
  email: string;
}

const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];

export async function criarTenant(
  a: Ambiente,
  opts: { plano?: 'BASICO' | 'PROFISSIONAL' | 'PREMIUM'; senha?: string } = {},
): Promise<Tenant> {
  contador++;
  const senha = opts.senha ?? 'senha-forte-123';
  const slug = `loja-${contador}-${Date.now().toString(36)}`;
  const email = `dono${contador}-${Date.now().toString(36)}@exemplo.com`;

  const cad = await request(a.app)
    .post('/api/v1/estabelecimentos')
    .send({ nome: `Loja ${contador}`, slug, cnpjCpf: gerarCpf(), email, senha, plano: opts.plano ?? 'PROFISSIONAL' });
  if (cad.status !== 201) throw new Error(`cadastro falhou: ${cad.status} ${JSON.stringify(cad.body)}`);

  const login = await request(a.app).post('/api/v1/auth/login').send({ email, senha });
  const token = login.body.token as string;
  const auth = { Authorization: `Bearer ${token}` };

  await request(a.app)
    .put('/api/v1/estabelecimentos/me/horarios-funcionamento')
    .set(auth)
    .send({ horariosFuncionamento: TODOS_OS_DIAS.map((d) => ({ diaSemana: d, inicio: '08:00', fim: '18:00' })) })
    .expect(200);

  const serv = await request(a.app)
    .post('/api/v1/servicos')
    .set(auth)
    .send({ nome: 'Corte masculino', preco: 40, duracaoMinutos: 30, fotoUrl: 'https://exemplo.com/foto.jpg' })
    .expect(201);

  const prof = await request(a.app)
    .post('/api/v1/profissionais')
    .set(auth)
    .send({
      nome: 'Rafael',
      servicoIds: [serv.body.id],
      horariosAtendimento: TODOS_OS_DIAS.map((d) => ({ diaSemana: d, inicio: '08:00', fim: '18:00' })),
    })
    .expect(201);

  return {
    token,
    estabelecimentoId: cad.body.id,
    slug,
    profissionalId: prof.body.id,
    servicoId: serv.body.id,
    email,
  };
}

let telefone = 0;
export function corpoAgendamento(t: Tenant, dataHora: string, extra: Record<string, unknown> = {}) {
  telefone++;
  return {
    estabelecimentoId: t.estabelecimentoId,
    profissionalId: t.profissionalId,
    servicoId: t.servicoId,
    nomeCliente: 'Marina Costa',
    whatsappCliente: `+55829${String(90_000_000 + telefone).slice(0, 8)}`,
    dataHora,
    ...extra,
  };
}

export const bearer = (t: Tenant) => ({ Authorization: `Bearer ${t.token}` });
