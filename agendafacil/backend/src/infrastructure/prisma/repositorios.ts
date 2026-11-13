import { Prisma, type PrismaClient } from '@prisma/client';
import type {
  Agendamento, Assinatura, Cobranca, Estabelecimento, JanelaHorario, Profissional, Servico,
} from '../../domain/entidades';
import { EstabelecimentoJaCadastradoError, NaoEncontradoError } from '../../domain/errors';
import type { Plano } from '../../domain/politica-planos';
import type {
  AgendamentoDetalhado, AgendamentoRepo, AssinaturaComEstabelecimento, AssinaturaRepo, CobrancaEmAberto,
  CobrancaRepo, DadosEstabelecimento, DadosProfissional, DadosServico, DetalhePlataforma, EstabelecimentoRepo,
  ItemAgenda, MetricasPlataforma, NotificacaoDevida, NotificacaoRepo, NovoEstabelecimento, PlataformaRepo,
  ProfissionalRepo, Repos, ResumoEstabelecimento, ServicoRepo, UnitOfWork, UsuarioPlataforma,
} from '../../application/ports';

export type Db = PrismaClient | Prisma.TransactionClient;

const num = (v: Prisma.Decimal | number) => Number(v);

function traduzirUnique(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new EstabelecimentoJaCadastradoError();
  throw e;
}

/* ---------- Mapeadores ---------- */

const toEst = (r: Prisma.EstabelecimentoGetPayload<object>): Estabelecimento => ({
  id: r.id, nome: r.nome, slug: r.slug, cnpjCpf: r.cnpjCpf, email: r.email, telefone: r.telefone,
  senhaHash: r.senhaHash, catalogoPublico: r.catalogoPublico, plano: r.plano, status: r.status,
  fusoHorario: r.fusoHorario, intervaloGradeMinutos: r.intervaloGradeMinutos,
  tituloAgenda: r.tituloAgenda, mensagemCancelamento: r.mensagemCancelamento, logoUrl: r.logoUrl, tema: r.tema, createdAt: r.createdAt,
});

const incluirProf = { horariosAtendimento: true, servicos: true } as const;
const toProf = (r: Prisma.ProfissionalGetPayload<{ include: typeof incluirProf }>): Profissional => ({
  id: r.id,
  estabelecimentoId: r.estabelecimentoId,
  nome: r.nome,
  ativo: r.ativo,
  servicoIds: r.servicos.map((s) => s.servicoId),
  horariosAtendimento: r.horariosAtendimento
    .map((h) => ({ diaSemana: h.diaSemana, inicio: h.inicio, fim: h.fim }))
    .sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio)),
});

const toServ = (r: Prisma.ServicoGetPayload<object>): Servico => ({
  id: r.id, estabelecimentoId: r.estabelecimentoId, nome: r.nome, preco: num(r.preco),
  duracaoMinutos: r.duracaoMinutos, fotoUrl: r.fotoUrl, ativo: r.ativo,
});

const toAg = (r: Prisma.AgendamentoGetPayload<object>): Agendamento => ({
  id: r.id, codigo: r.codigo, estabelecimentoId: r.estabelecimentoId, profissionalId: r.profissionalId,
  servicoId: r.servicoId, nomeCliente: r.nomeCliente, whatsappCliente: r.whatsappCliente,
  dataHora: r.dataHora, status: r.status, createdAt: r.createdAt,
});

const toAss = (r: Prisma.AssinaturaGetPayload<object>): Assinatura => ({
  id: r.id, estabelecimentoId: r.estabelecimentoId, plano: r.plano, valorMensal: num(r.valorMensal),
  status: r.status, planoAgendado: r.planoAgendado, cancelarNoFimDoCiclo: r.cancelarNoFimDoCiclo,
  inicio: r.inicio, proximaCobranca: r.proximaCobranca,
});

const toCob = (r: Prisma.CobrancaGetPayload<object>): Cobranca => ({
  id: r.id, assinaturaId: r.assinaturaId, valor: num(r.valor), vencimento: r.vencimento,
  status: r.status, pagoEm: r.pagoEm, referenciaExterna: r.referenciaExterna,
});

/* ---------- Estabelecimento ---------- */

class PrismaEstabelecimentoRepo implements EstabelecimentoRepo {
  constructor(private db: Db) {}

  async buscarPorId(id: string) {
    const r = await this.db.estabelecimento.findUnique({ where: { id } });
    return r ? toEst(r) : null;
  }
  async buscarPorSlug(slug: string) {
    const r = await this.db.estabelecimento.findUnique({ where: { slug } });
    return r ? toEst(r) : null;
  }
  async buscarPorEmail(email: string) {
    const r = await this.db.estabelecimento.findUnique({ where: { email } });
    return r ? toEst(r) : null;
  }
  async existeConflito(d: { cnpjCpf: string; email: string; slug: string }, ignorarId?: string) {
    const n = await this.db.estabelecimento.count({
      where: {
        OR: [{ cnpjCpf: d.cnpjCpf }, { email: d.email }, { slug: d.slug }],
        ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
      },
    });
    return n > 0;
  }
  async criarComAssinatura(
    dados: NovoEstabelecimento,
    ass: { plano: Plano; valorMensal: number; inicio: Date; proximaCobranca: Date },
  ) {
    try {
      const r = await this.db.estabelecimento.create({
        data: {
          ...dados,
          assinatura: {
            create: { plano: ass.plano, valorMensal: ass.valorMensal, inicio: ass.inicio, proximaCobranca: ass.proximaCobranca },
          },
        },
      });
      return toEst(r);
    } catch (e) {
      return traduzirUnique(e);
    }
  }
  async atualizar(id: string, dados: DadosEstabelecimento) {
    try {
      return toEst(await this.db.estabelecimento.update({ where: { id }, data: dados }));
    } catch (e) {
      return traduzirUnique(e);
    }
  }
  async listarHorariosFuncionamento(estabelecimentoId: string): Promise<JanelaHorario[]> {
    const rs = await this.db.horarioFuncionamento.findMany({
      where: { estabelecimentoId },
      orderBy: [{ diaSemana: 'asc' }, { abre: 'asc' }],
    });
    return rs.map((h) => ({ diaSemana: h.diaSemana, inicio: h.abre, fim: h.fecha }));
  }
  async substituirHorariosFuncionamento(estabelecimentoId: string, janelas: JanelaHorario[]) {
    // Uma única chamada aninhada = atômica.
    await this.db.estabelecimento.update({
      where: { id: estabelecimentoId },
      data: {
        horariosFuncionamento: {
          deleteMany: {},
          create: janelas.map((j) => ({ diaSemana: j.diaSemana, abre: j.inicio, fecha: j.fim })),
        },
      },
    });
  }
}

/* ---------- Profissional ---------- */

class PrismaProfissionalRepo implements ProfissionalRepo {
  constructor(private db: Db) {}

  async buscarPorId(estabelecimentoId: string, id: string) {
    const r = await this.db.profissional.findFirst({ where: { id, estabelecimentoId }, include: incluirProf });
    return r ? toProf(r) : null;
  }
  async listar(estabelecimentoId: string, apenasAtivos = false) {
    const rs = await this.db.profissional.findMany({
      where: { estabelecimentoId, ...(apenasAtivos ? { ativo: true } : {}) },
      include: incluirProf,
      orderBy: { nome: 'asc' },
    });
    return rs.map(toProf);
  }
  async criar(estabelecimentoId: string, d: DadosProfissional) {
    const r = await this.db.profissional.create({
      data: {
        estabelecimentoId,
        nome: d.nome,
        servicos: { create: d.servicoIds.map((servicoId) => ({ servicoId })) },
        horariosAtendimento: { create: d.horariosAtendimento },
      },
      include: incluirProf,
    });
    return toProf(r);
  }
  async atualizar(estabelecimentoId: string, id: string, d: Partial<DadosProfissional> & { ativo?: boolean }) {
    const existe = await this.db.profissional.findFirst({ where: { id, estabelecimentoId }, select: { id: true } });
    if (!existe) throw new NaoEncontradoError('Profissional não encontrado');
    const r = await this.db.profissional.update({
      where: { id },
      data: {
        ...(d.nome !== undefined ? { nome: d.nome } : {}),
        ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
        ...(d.servicoIds ? { servicos: { deleteMany: {}, create: d.servicoIds.map((servicoId) => ({ servicoId })) } } : {}),
        ...(d.horariosAtendimento ? { horariosAtendimento: { deleteMany: {}, create: d.horariosAtendimento } } : {}),
      },
      include: incluirProf,
    });
    return toProf(r);
  }
  async excluir(estabelecimentoId: string, id: string) {
    await this.db.profissional.deleteMany({ where: { id, estabelecimentoId } });
  }
  async bloquear(estabelecimentoId: string, id: string) {
    await this.db.$queryRaw`SELECT id FROM profissionais WHERE id = ${id}::uuid AND estabelecimento_id = ${estabelecimentoId}::uuid FOR UPDATE`;
  }
  contarAgendamentosFuturos(estabelecimentoId: string, id: string, agora: Date) {
    return this.db.agendamento.count({
      where: { estabelecimentoId, profissionalId: id, status: 'CONFIRMADO', dataHora: { gt: agora } },
    });
  }
}

/* ---------- Serviço ---------- */

class PrismaServicoRepo implements ServicoRepo {
  constructor(private db: Db) {}

  async buscarPorId(estabelecimentoId: string, id: string) {
    const r = await this.db.servico.findFirst({ where: { id, estabelecimentoId } });
    return r ? toServ(r) : null;
  }
  async listar(estabelecimentoId: string, apenasAtivos = false) {
    const rs = await this.db.servico.findMany({
      where: { estabelecimentoId, ...(apenasAtivos ? { ativo: true } : {}) },
      orderBy: { nome: 'asc' },
    });
    return rs.map(toServ);
  }
  contarPorIds(estabelecimentoId: string, ids: string[]) {
    return this.db.servico.count({ where: { estabelecimentoId, id: { in: ids } } });
  }
  contarProfissionaisQueDependemDoServico(estabelecimentoId: string, id: string) {
    return this.db.profissional.count({
      where: {
        estabelecimentoId,
        servicos: {
          some: { servicoId: id },
          none: { servicoId: { not: id } },
        },
      },
    });
  }
  async criar(estabelecimentoId: string, d: DadosServico) {
    return toServ(await this.db.servico.create({ data: { estabelecimentoId, ...d } }));
  }
  async atualizar(estabelecimentoId: string, id: string, d: Partial<DadosServico> & { ativo?: boolean }) {
    const existe = await this.db.servico.findFirst({ where: { id, estabelecimentoId }, select: { id: true } });
    if (!existe) throw new NaoEncontradoError('Serviço não encontrado');
    return toServ(await this.db.servico.update({ where: { id }, data: d }));
  }
  async excluir(estabelecimentoId: string, id: string) {
    await this.db.servico.deleteMany({ where: { id, estabelecimentoId } });
  }
  contarAgendamentosFuturos(estabelecimentoId: string, id: string, agora: Date) {
    return this.db.agendamento.count({
      where: { estabelecimentoId, servicoId: id, status: 'CONFIRMADO', dataHora: { gt: agora } },
    });
  }
}

/* ---------- Agendamento ---------- */

class PrismaAgendamentoRepo implements AgendamentoRepo {
  constructor(private db: Db) {}

  async criar(d: Omit<Agendamento, 'id' | 'createdAt'>) {
    return toAg(await this.db.agendamento.create({ data: d }));
  }
  async codigoExiste(codigo: string) {
    return (await this.db.agendamento.count({ where: { codigo } })) > 0;
  }
  async buscarPorCodigo(codigo: string, estabelecimentoId?: string): Promise<AgendamentoDetalhado | null> {
    const r = await this.db.agendamento.findFirst({
      where: { codigo, ...(estabelecimentoId ? { estabelecimentoId } : {}) },
      include: { servico: true, profissional: true, estabelecimento: true },
    });
    if (!r) return null;
    return {
      ...toAg(r),
      servicoNome: r.servico.nome,
      servicoDuracaoMinutos: r.servico.duracaoMinutos,
      profissionalNome: r.profissional.nome,
      estabelecimentoNome: r.estabelecimento.nome,
      estabelecimentoSlug: r.estabelecimento.slug,
      estabelecimentoFuso: r.estabelecimento.fusoHorario,
      estabelecimentoPlano: r.estabelecimento.plano,
    };
  }
  async atualizarStatus(id: string, status: Agendamento['status']) {
    return toAg(await this.db.agendamento.update({ where: { id }, data: { status } }));
  }
  async listarOcupados(estabelecimentoId: string, profissionalId: string, de: Date, ate: Date) {
    // Janela ampliada em 12h para pegar atendimentos que começam antes do dia e avançam sobre ele.
    const rs = await this.db.agendamento.findMany({
      where: {
        estabelecimentoId, profissionalId, status: 'CONFIRMADO',
        dataHora: { gte: new Date(de.getTime() - 12 * 3_600_000), lte: ate },
      },
      include: { servico: { select: { duracaoMinutos: true } } },
    });
    return rs.map((r) => ({
      inicio: r.dataHora,
      fim: new Date(r.dataHora.getTime() + r.servico.duracaoMinutos * 60_000),
    }));
  }
  async listarAgenda(estabelecimentoId: string, de: Date, ate: Date, profissionalId?: string): Promise<ItemAgenda[]> {
    const rs = await this.db.agendamento.findMany({
      where: { estabelecimentoId, dataHora: { gte: de, lte: ate }, ...(profissionalId ? { profissionalId } : {}) },
      include: {
        servico: { select: { nome: true } },
        profissional: { select: { nome: true } },
        notificacoes: { select: { status: true, ultimoErro: true, createdAt: true } },
      },
      orderBy: { dataHora: 'asc' },
    });
    return rs.map((r) => ({
      codigo: r.codigo, nomeCliente: r.nomeCliente, servico: r.servico.nome, profissional: r.profissional.nome,
      dataHora: r.dataHora, status: r.status, notificacoes: r.notificacoes,
    }));
  }
  async contarPorStatus(estabelecimentoId: string, de: Date, ate: Date) {
    const [confirmados, cancelados] = await Promise.all([
      this.db.agendamento.count({ where: { estabelecimentoId, status: 'CONFIRMADO', dataHora: { gte: de, lte: ate } } }),
      this.db.agendamento.count({ where: { estabelecimentoId, status: 'CANCELADO', dataHora: { gte: de, lte: ate } } }),
    ]);
    return { confirmados, cancelados };
  }
}

/* ---------- Notificações ---------- */

class PrismaNotificacaoRepo implements NotificacaoRepo {
  constructor(private db: Db) {}

  async criar(agendamentoId: string, tipo: 'CONFIRMACAO' | 'LEMBRETE' | 'CANCELAMENTO', agendadaPara: Date) {
    await this.db.notificacaoWhatsapp.create({ data: { agendamentoId, tipo, agendadaPara } });
  }
  async descartarPendentes(agendamentoId: string, tipos: ('CONFIRMACAO' | 'LEMBRETE' | 'CANCELAMENTO')[]) {
    await this.db.notificacaoWhatsapp.deleteMany({ where: { agendamentoId, status: 'PENDENTE', tipo: { in: tipos } } });
  }
  async listarDevidas(agora: Date, limite: number): Promise<NotificacaoDevida[]> {
    const rs = await this.db.notificacaoWhatsapp.findMany({
      where: { status: 'PENDENTE', agendadaPara: { lte: agora } },
      include: { agendamento: { include: { servico: true, profissional: true, estabelecimento: true } } },
      orderBy: { agendadaPara: 'asc' },
      take: limite,
    });
    return rs.map((n) => ({
      id: n.id, agendamentoId: n.agendamentoId, tipo: n.tipo, status: n.status, tentativas: n.tentativas,
      ultimoErro: n.ultimoErro, agendadaPara: n.agendadaPara, enviadaEm: n.enviadaEm,
      whatsappCliente: n.agendamento.whatsappCliente,
      codigo: n.agendamento.codigo,
      dataHora: n.agendamento.dataHora,
      servicoNome: n.agendamento.servico.nome,
      profissionalNome: n.agendamento.profissional.nome,
      fuso: n.agendamento.estabelecimento.fusoHorario,
      nomeEstabelecimento: n.agendamento.estabelecimento.nome,
    }));
  }
  async marcarEnviada(id: string, em: Date) {
    await this.db.notificacaoWhatsapp.update({ where: { id }, data: { status: 'ENVIADA', enviadaEm: em, ultimoErro: null } });
  }
  async registrarResultadoFalha(
    id: string,
    d: { tentativas: number; erro: string; status: 'PENDENTE' | 'ENVIADA' | 'FALHA'; agendadaPara: Date },
  ) {
    await this.db.notificacaoWhatsapp.update({
      where: { id },
      data: { tentativas: d.tentativas, ultimoErro: d.erro, status: d.status, agendadaPara: d.agendadaPara },
    });
  }
}

/* ---------- Assinatura e cobrança ---------- */

class PrismaAssinaturaRepo implements AssinaturaRepo {
  constructor(private db: Db) {}

  async buscarPorEstabelecimento(estabelecimentoId: string) {
    const r = await this.db.assinatura.findUnique({ where: { estabelecimentoId } });
    return r ? toAss(r) : null;
  }
  async atualizar(estabelecimentoId: string, dados: Parameters<AssinaturaRepo['atualizar']>[1]) {
    return toAss(await this.db.assinatura.update({ where: { estabelecimentoId }, data: dados }));
  }
  async listarComCicloVencido(hoje: Date): Promise<AssinaturaComEstabelecimento[]> {
    const rs = await this.db.assinatura.findMany({
      where: {
        status: { in: ['ATIVA', 'EM_ATRASO'] },
        proximaCobranca: { lte: hoje },
        estabelecimento: { status: { not: 'CANCELADO' } },
      },
      include: { estabelecimento: { select: { status: true } } },
    });
    return rs.map((r) => ({ ...toAss(r), estabelecimentoStatus: r.estabelecimento.status }));
  }
}

class PrismaCobrancaRepo implements CobrancaRepo {
  constructor(private db: Db) {}

  async criar(d: Parameters<CobrancaRepo['criar']>[0]) {
    return toCob(await this.db.cobranca.create({ data: d }));
  }
  async listarPorEstabelecimento(estabelecimentoId: string) {
    const rs = await this.db.cobranca.findMany({
      where: { assinatura: { estabelecimentoId } },
      orderBy: { vencimento: 'desc' },
    });
    return rs.map(toCob);
  }
  async listarEmAbertoVencidas(hoje: Date): Promise<CobrancaEmAberto[]> {
    const rs = await this.db.cobranca.findMany({
      where: { status: { in: ['PENDENTE', 'FALHA'] }, vencimento: { lt: hoje } },
      include: { assinatura: { select: { estabelecimentoId: true, status: true } } },
      orderBy: { vencimento: 'asc' },
    });
    return rs.map((r) => ({
      ...toCob(r), estabelecimentoId: r.assinatura.estabelecimentoId, assinaturaStatus: r.assinatura.status,
    }));
  }
  async buscarPorReferencia(referenciaExterna: string) {
    const r = await this.db.cobranca.findFirst({
      where: { referenciaExterna },
      include: { assinatura: { select: { estabelecimentoId: true } } },
    });
    return r ? { ...toCob(r), estabelecimentoId: r.assinatura.estabelecimentoId } : null;
  }
  async marcarPaga(id: string, em: Date) {
    await this.db.cobranca.update({ where: { id }, data: { status: 'PAGA', pagoEm: em } });
  }
  async marcarFalha(id: string) {
    await this.db.cobranca.update({ where: { id }, data: { status: 'FALHA' } });
  }
}

/* ---------- Plataforma (backoffice, somente agregados) ---------- */

class PrismaPlataformaRepo implements PlataformaRepo {
  constructor(private db: Db) {}

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioPlataforma | null> {
    const r = await this.db.usuarioPlataforma.findUnique({ where: { email } });
    return r ? { id: r.id, nome: r.nome, email: r.email, senhaHash: r.senhaHash, papel: r.papel } : null;
  }

  async listarEstabelecimentos(f: { status?: ResumoEstabelecimento['status']; plano?: Plano; busca?: string }) {
    const rs = await this.db.estabelecimento.findMany({
      where: {
        ...(f.status ? { status: f.status } : {}),
        ...(f.plano ? { plano: f.plano } : {}),
        ...(f.busca
          ? {
              OR: [
                { nome: { contains: f.busca, mode: 'insensitive' as const } },
                { slug: { contains: f.busca, mode: 'insensitive' as const } },
                { email: { contains: f.busca, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      include: { assinatura: { select: { status: true, proximaCobranca: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rs.map((r): ResumoEstabelecimento => ({
      id: r.id, nome: r.nome, slug: r.slug, plano: r.plano, status: r.status,
      statusAssinatura: r.assinatura?.status ?? null,
      proximaCobranca: r.assinatura?.proximaCobranca ?? null,
      createdAt: r.createdAt,
    }));
  }

  async detalhe(estabelecimentoId: string): Promise<DetalhePlataforma | null> {
    const r = await this.db.estabelecimento.findUnique({
      where: { id: estabelecimentoId },
      include: { assinatura: { include: { cobrancas: { orderBy: { vencimento: 'desc' }, take: 12 } } } },
    });
    if (!r) return null;
    const falhas = await this.db.notificacaoWhatsapp.findMany({
      where: { status: 'FALHA', agendamento: { estabelecimentoId } },
      orderBy: { agendadaPara: 'desc' },
      take: 20,
      select: { tipo: true, ultimoErro: true, agendadaPara: true },
    });
    return {
      resumo: {
        id: r.id, nome: r.nome, slug: r.slug, plano: r.plano, status: r.status,
        statusAssinatura: r.assinatura?.status ?? null,
        proximaCobranca: r.assinatura?.proximaCobranca ?? null,
        createdAt: r.createdAt,
      },
      cobrancas: (r.assinatura?.cobrancas ?? []).map(toCob),
      falhasWhatsappRecentes: falhas,
    };
  }

  async metricas(agora: Date): Promise<MetricasPlataforma> {
    const desde = new Date(agora.getTime() - 30 * 86_400_000);
    const [ativos, porPlano, mrr, emAtraso, enviadas, falhas] = await Promise.all([
      this.db.estabelecimento.count({ where: { status: 'ATIVO' } }),
      this.db.estabelecimento.groupBy({ by: ['plano'], where: { status: 'ATIVO' }, _count: { _all: true } }),
      this.db.assinatura.aggregate({
        _sum: { valorMensal: true },
        where: { status: { in: ['ATIVA', 'EM_ATRASO'] }, estabelecimento: { status: 'ATIVO' } },
      }),
      this.db.assinatura.count({ where: { status: 'EM_ATRASO' } }),
      this.db.notificacaoWhatsapp.count({ where: { status: 'ENVIADA', enviadaEm: { gte: desde } } }),
      this.db.notificacaoWhatsapp.count({ where: { status: 'FALHA', agendadaPara: { gte: desde } } }),
    ]);
    const contratantesPorPlano: Record<Plano, number> = { BASICO: 0, PROFISSIONAL: 0, PREMIUM: 0 };
    for (const p of porPlano) contratantesPorPlano[p.plano] = p._count._all;
    return {
      contratantesAtivos: ativos,
      contratantesPorPlano,
      mrr: num(mrr._sum.valorMensal ?? 0),
      assinaturasEmAtraso: emAtraso,
      notificacoesEnviadas30d: enviadas,
      notificacoesComFalha30d: falhas,
    };
  }

  async registrarAuditoria(d: { usuarioId: string; acao: string; estabelecimentoId: string | null; detalhe: string | null }) {
    await this.db.auditoriaPlataforma.create({ data: d });
  }
}

/* ---------- Composição ---------- */

export function criarRepos(db: Db): Repos {
  return {
    estabelecimentos: new PrismaEstabelecimentoRepo(db),
    profissionais: new PrismaProfissionalRepo(db),
    servicos: new PrismaServicoRepo(db),
    agendamentos: new PrismaAgendamentoRepo(db),
    notificacoes: new PrismaNotificacaoRepo(db),
    assinaturas: new PrismaAssinaturaRepo(db),
    cobrancas: new PrismaCobrancaRepo(db),
    plataforma: new PrismaPlataformaRepo(db),
  };
}

export class PrismaUnitOfWork implements UnitOfWork {
  readonly repos: Repos;
  constructor(private prisma: PrismaClient) {
    this.repos = criarRepos(prisma);
  }
  executar<T>(fn: (repos: Repos) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(criarRepos(tx)), { maxWait: 5_000, timeout: 15_000 });
  }
}
