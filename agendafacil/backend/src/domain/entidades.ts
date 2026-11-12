import type { Plano } from './politica-planos';

export type StatusEstabelecimento = 'ATIVO' | 'SUSPENSO' | 'CANCELADO';
export type StatusAgendamento = 'CONFIRMADO' | 'CANCELADO';
export type StatusAssinatura = 'ATIVA' | 'EM_ATRASO' | 'SUSPENSA' | 'CANCELADA';
export type StatusCobranca = 'PENDENTE' | 'PAGA' | 'FALHA';
export type TipoNotificacao = 'CONFIRMACAO' | 'LEMBRETE' | 'CANCELAMENTO';
export type StatusNotificacao = 'PENDENTE' | 'ENVIADA' | 'FALHA';
export type PapelPlataforma = 'ADMIN' | 'SUPORTE';

export interface Estabelecimento {
  id: string;
  nome: string;
  slug: string;
  cnpjCpf: string;
  email: string;
  telefone: string | null;
  senhaHash: string;
  catalogoPublico: boolean;
  plano: Plano;
  status: StatusEstabelecimento;
  fusoHorario: string;
  intervaloGradeMinutos: number;
  /** Título exibido no painel e na página pública (opcional). */
  tituloAgenda: string | null;
  /** URL da logo (só planos com logoPersonalizada). */
  logoUrl: string | null;
  tema: string;
  createdAt: Date;
}

/** Janela semanal. diaSemana: 0 = domingo. Horas em "HH:mm". */
export interface JanelaHorario {
  diaSemana: number;
  inicio: string;
  fim: string;
}

export interface Profissional {
  id: string;
  estabelecimentoId: string;
  nome: string;
  ativo: boolean;
  servicoIds: string[];
  horariosAtendimento: JanelaHorario[];
}

export interface Servico {
  id: string;
  estabelecimentoId: string;
  nome: string;
  preco: number;
  duracaoMinutos: number;
  fotoUrl: string | null;
  ativo: boolean;
}

export interface Agendamento {
  id: string;
  codigo: string;
  estabelecimentoId: string;
  profissionalId: string;
  servicoId: string;
  nomeCliente: string;
  whatsappCliente: string;
  dataHora: Date;
  status: StatusAgendamento;
  createdAt: Date;
}

export interface Assinatura {
  id: string;
  estabelecimentoId: string;
  plano: Plano;
  valorMensal: number;
  status: StatusAssinatura;
  planoAgendado: Plano | null;
  cancelarNoFimDoCiclo: boolean;
  inicio: Date;
  proximaCobranca: Date | null;
}

export interface Cobranca {
  id: string;
  assinaturaId: string;
  valor: number;
  vencimento: Date;
  status: StatusCobranca;
  pagoEm: Date | null;
  referenciaExterna: string | null;
}

export interface Notificacao {
  id: string;
  agendamentoId: string;
  tipo: TipoNotificacao;
  status: StatusNotificacao;
  tentativas: number;
  ultimoErro: string | null;
  agendadaPara: Date;
  enviadaEm: Date | null;
}
