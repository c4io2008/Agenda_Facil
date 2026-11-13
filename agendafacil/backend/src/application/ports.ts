import type {
  Agendamento, Assinatura, Cobranca, Estabelecimento, JanelaHorario, Notificacao,
  PapelPlataforma, Profissional, Servico, StatusAgendamento, StatusAssinatura, StatusCobranca,
  StatusEstabelecimento, StatusNotificacao, TipoNotificacao,
} from '../domain/entidades';
import type { Ocupacao } from '../domain/grade';
import type { Plano } from '../domain/politica-planos';

/* ---------- Portas de serviços externos ---------- */

export interface Relogio {
  agora(): Date;
}

export interface WhatsAppGateway {
  /** Lança exceção em caso de falha. */
  enviar(para: string, texto: string): Promise<void>;
}

export interface ResultadoCobranca {
  referenciaExterna: string;
  status: StatusCobranca;
}

export interface ProvedorPagamento {
  cobrar(dados: { assinaturaId: string; estabelecimentoId: string; valor: number; vencimento: Date }): Promise<ResultadoCobranca>;
}

export interface HasherSenha {
  gerar(senha: string): Promise<string>;
  comparar(senha: string, hash: string): Promise<boolean>;
}

export type PayloadToken =
  | { tipo: 'CONTRATANTE'; sub: string; estabelecimentoId: string }
  | { tipo: 'PLATAFORMA'; sub: string; papel: PapelPlataforma };

export interface EmissorToken {
  emitir(payload: PayloadToken): { token: string; expiraEm: Date };
  verificar(token: string): PayloadToken;
}

export interface GeradorCodigo {
  gerar(): string;
}

/* ---------- Repositórios ---------- */
/* Toda entidade de tenant exige estabelecimentoId como primeiro parâmetro. */

export interface NovoEstabelecimento {
  nome: string;
  slug: string;
  cnpjCpf: string;
  email: string;
  telefone: string | null;
  senhaHash: string;
  plano: Plano;
}

export type DadosEstabelecimento = Partial<
  Pick<Estabelecimento, 'nome' | 'slug' | 'telefone' | 'fusoHorario' | 'intervaloGradeMinutos' | 'catalogoPublico' | 'plano' | 'status' | 'tituloAgenda' | 'mensagemCancelamento' | 'logoUrl' | 'logoPosX' | 'logoPosY' | 'logoZoom' | 'tema'>
>;

export interface EstabelecimentoRepo {
  buscarPorId(id: string): Promise<Estabelecimento | null>;
  buscarPorSlug(slug: string): Promise<Estabelecimento | null>;
  buscarPorEmail(email: string): Promise<Estabelecimento | null>;
  existeConflito(dados: { cnpjCpf: string; email: string; slug: string }, ignorarId?: string): Promise<boolean>;
  criarComAssinatura(
    dados: NovoEstabelecimento,
    assinatura: { plano: Plano; valorMensal: number; inicio: Date; proximaCobranca: Date },
  ): Promise<Estabelecimento>;
  atualizar(id: string, dados: DadosEstabelecimento): Promise<Estabelecimento>;
  listarHorariosFuncionamento(estabelecimentoId: string): Promise<JanelaHorario[]>;
  substituirHorariosFuncionamento(estabelecimentoId: string, janelas: JanelaHorario[]): Promise<void>;
}

export interface DadosProfissional {
  nome: string;
  servicoIds: string[];
  horariosAtendimento: JanelaHorario[];
}

export interface ProfissionalRepo {
  buscarPorId(estabelecimentoId: string, id: string): Promise<Profissional | null>;
  listar(estabelecimentoId: string, apenasAtivos?: boolean): Promise<Profissional[]>;
  criar(estabelecimentoId: string, dados: DadosProfissional): Promise<Profissional>;
  atualizar(estabelecimentoId: string, id: string, dados: Partial<DadosProfissional> & { ativo?: boolean }): Promise<Profissional>;
  excluir(estabelecimentoId: string, id: string): Promise<void>;
  /** SELECT ... FOR UPDATE: serializa agendamentos concorrentes do mesmo profissional (RN-06). */
  bloquear(estabelecimentoId: string, id: string): Promise<void>;
  contarAgendamentosFuturos(estabelecimentoId: string, id: string, agora: Date): Promise<number>;
}

export interface DadosServico {
  nome: string;
  preco: number;
  duracaoMinutos: number;
  fotoUrl: string | null;
  descricao: string | null;
}

export interface ServicoRepo {
  buscarPorId(estabelecimentoId: string, id: string): Promise<Servico | null>;
  listar(estabelecimentoId: string, apenasAtivos?: boolean): Promise<Servico[]>;
  contarPorIds(estabelecimentoId: string, ids: string[]): Promise<number>;
  contarProfissionaisQueDependemDoServico(estabelecimentoId: string, id: string): Promise<number>;
  criar(estabelecimentoId: string, dados: DadosServico): Promise<Servico>;
  atualizar(estabelecimentoId: string, id: string, dados: Partial<DadosServico> & { ativo?: boolean }): Promise<Servico>;
  excluir(estabelecimentoId: string, id: string): Promise<void>;
  contarAgendamentosFuturos(estabelecimentoId: string, id: string, agora: Date): Promise<number>;
}

export interface AgendamentoDetalhado extends Agendamento {
  servicoNome: string;
  servicoDuracaoMinutos: number;
  profissionalNome: string;
  estabelecimentoNome: string;
  estabelecimentoSlug: string;
  estabelecimentoFuso: string;
  estabelecimentoPlano: Plano;
}

export interface ItemAgenda {
  codigo: string;
  nomeCliente: string;
  servico: string;
  profissional: string;
  dataHora: Date;
  status: StatusAgendamento;
  notificacoes: { status: StatusNotificacao; ultimoErro: string | null; createdAt: Date }[];
}

export interface AgendamentoRepo {
  criar(dados: Omit<Agendamento, 'id' | 'createdAt'>): Promise<Agendamento>;
  codigoExiste(codigo: string): Promise<boolean>;
  /** Com estabelecimentoId, restringe ao tenant (404 para outro tenant). */
  buscarPorCodigo(codigo: string, estabelecimentoId?: string): Promise<AgendamentoDetalhado | null>;
  atualizarStatus(id: string, status: StatusAgendamento): Promise<Agendamento>;
  listarOcupados(estabelecimentoId: string, profissionalId: string, de: Date, ate: Date): Promise<Ocupacao[]>;
  listarAgenda(estabelecimentoId: string, de: Date, ate: Date, profissionalId?: string): Promise<ItemAgenda[]>;
  contarPorStatus(estabelecimentoId: string, de: Date, ate: Date): Promise<{ confirmados: number; cancelados: number }>;
}

export interface NotificacaoDevida extends Notificacao {
  whatsappCliente: string;
  codigo: string;
  dataHora: Date;
  servicoNome: string;
  profissionalNome: string;
  fuso: string;
  nomeEstabelecimento: string;
}

export interface NotificacaoRepo {
  criar(agendamentoId: string, tipo: TipoNotificacao, agendadaPara: Date): Promise<void>;
  descartarPendentes(agendamentoId: string, tipos: TipoNotificacao[]): Promise<void>;
  /** Operação de sistema (job): atravessa tenants. */
  listarDevidas(agora: Date, limite: number): Promise<NotificacaoDevida[]>;
  marcarEnviada(id: string, em: Date): Promise<void>;
  registrarResultadoFalha(id: string, dados: { tentativas: number; erro: string; status: StatusNotificacao; agendadaPara: Date }): Promise<void>;
}

export interface AssinaturaComEstabelecimento extends Assinatura {
  estabelecimentoStatus: StatusEstabelecimento;
}

export interface AssinaturaRepo {
  buscarPorEstabelecimento(estabelecimentoId: string): Promise<Assinatura | null>;
  atualizar(
    estabelecimentoId: string,
    dados: Partial<Pick<Assinatura, 'plano' | 'valorMensal' | 'status' | 'planoAgendado' | 'cancelarNoFimDoCiclo' | 'proximaCobranca'>>,
  ): Promise<Assinatura>;
  /** Job de cobrança: assinaturas ATIVA/EM_ATRASO com proximaCobranca <= hoje. */
  listarComCicloVencido(hoje: Date): Promise<AssinaturaComEstabelecimento[]>;
}

export interface CobrancaEmAberto extends Cobranca {
  estabelecimentoId: string;
  assinaturaStatus: StatusAssinatura;
}

export interface CobrancaRepo {
  criar(dados: { assinaturaId: string; valor: number; vencimento: Date; status: StatusCobranca; referenciaExterna: string | null; pagoEm?: Date | null }): Promise<Cobranca>;
  listarPorEstabelecimento(estabelecimentoId: string): Promise<Cobranca[]>;
  listarEmAbertoVencidas(hoje: Date): Promise<CobrancaEmAberto[]>;
  buscarPorReferencia(referenciaExterna: string): Promise<(Cobranca & { estabelecimentoId: string }) | null>;
  marcarPaga(id: string, em: Date): Promise<void>;
  marcarFalha(id: string): Promise<void>;
}

export interface UsuarioPlataforma {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papel: PapelPlataforma;
}

export interface ResumoEstabelecimento {
  id: string;
  nome: string;
  slug: string;
  plano: Plano;
  status: StatusEstabelecimento;
  statusAssinatura: StatusAssinatura | null;
  proximaCobranca: Date | null;
  createdAt: Date;
}

export interface DetalhePlataforma {
  resumo: ResumoEstabelecimento;
  cobrancas: Cobranca[];
  /** Somente contadores/erros técnicos: nunca nome ou WhatsApp do Cliente Final. */
  falhasWhatsappRecentes: { tipo: TipoNotificacao; ultimoErro: string | null; agendadaPara: Date }[];
}

export interface MetricasPlataforma {
  contratantesAtivos: number;
  contratantesPorPlano: Record<Plano, number>;
  mrr: number;
  assinaturasEmAtraso: number;
  notificacoesEnviadas30d: number;
  notificacoesComFalha30d: number;
}

export interface PlataformaRepo {
  buscarUsuarioPorEmail(email: string): Promise<UsuarioPlataforma | null>;
  listarEstabelecimentos(filtros: { status?: StatusEstabelecimento; plano?: Plano; busca?: string }): Promise<ResumoEstabelecimento[]>;
  detalhe(estabelecimentoId: string): Promise<DetalhePlataforma | null>;
  metricas(agora: Date): Promise<MetricasPlataforma>;
  registrarAuditoria(dados: { usuarioId: string; acao: string; estabelecimentoId: string | null; detalhe: string | null }): Promise<void>;
}

export interface Repos {
  estabelecimentos: EstabelecimentoRepo;
  profissionais: ProfissionalRepo;
  servicos: ServicoRepo;
  agendamentos: AgendamentoRepo;
  notificacoes: NotificacaoRepo;
  assinaturas: AssinaturaRepo;
  cobrancas: CobrancaRepo;
  plataforma: PlataformaRepo;
}

export interface UnitOfWork {
  repos: Repos;
  /** Executa `fn` em uma transação com repositórios vinculados a ela. */
  executar<T>(fn: (repos: Repos) => Promise<T>): Promise<T>;
}

export interface Config {
  lembreteAntecedenciaHoras: number;
  toleranciaDiasAtraso: number;
  whatsappRetryMinutos: number;
  appPublicUrl: string;
  maxTentativasWhatsapp: number;
}
