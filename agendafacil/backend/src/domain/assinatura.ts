import type { Assinatura, Estabelecimento } from './entidades';

/** RN-08: só Contratante ATIVO com assinatura ATIVA ou EM_ATRASO (na tolerância) aceita novos agendamentos. */
export function aceitaNovosAgendamentos(est: Pick<Estabelecimento, 'status'>, ass: Pick<Assinatura, 'status'> | null): boolean {
  return est.status === 'ATIVO' && ass !== null && (ass.status === 'ATIVA' || ass.status === 'EM_ATRASO');
}

/** Painel editável: mesma condição de RN-08. SUSPENSA/CANCELADA = somente leitura. */
export const painelEditavel = aceitaNovosAgendamentos;

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
export { ALFABETO as ALFABETO_CODIGO };
