import type { Agendamento, Assinatura, Estabelecimento } from '../domain/entidades';
import { aceitaNovosAgendamentos, painelEditavel } from '../domain/assinatura';
import { AssinaturaInativaError, NaoEncontradoError, PainelSomenteLeituraError } from '../domain/errors';
import type { Repos } from './ports';

export async function exigirEstabelecimento(repos: Repos, id: string): Promise<Estabelecimento> {
  const est = await repos.estabelecimentos.buscarPorId(id);
  if (!est) throw new NaoEncontradoError('Estabelecimento não encontrado');
  return est;
}

/** Contratante autenticado em modo escrita: bloqueia painel somente leitura (RN-08). */
export async function exigirPainelEditavel(repos: Repos, estabelecimentoId: string): Promise<Estabelecimento> {
  const est = await exigirEstabelecimento(repos, estabelecimentoId);
  const ass = await repos.assinaturas.buscarPorEstabelecimento(estabelecimentoId);
  if (!painelEditavel(est, ass)) throw new PainelSomenteLeituraError();
  return est;
}

/** Contexto público por slug: 404 para inexistente/CANCELADO, 403 para inativo (CB-05, CB-07). */
export async function carregarContextoPublico(
  repos: Repos,
  slug: string,
): Promise<{ est: Estabelecimento; assinatura: Assinatura | null }> {
  const est = await repos.estabelecimentos.buscarPorSlug(slug);
  if (!est || est.status === 'CANCELADO') throw new NaoEncontradoError('Estabelecimento não encontrado');
  const assinatura = await repos.assinaturas.buscarPorEstabelecimento(est.id);
  if (!aceitaNovosAgendamentos(est, assinatura)) throw new AssinaturaInativaError();
  return { est, assinatura };
}

export function agendamentoParaDTO(a: Agendamento) {
  return {
    id: a.id,
    codigo: a.codigo,
    profissionalId: a.profissionalId,
    servicoId: a.servicoId,
    nomeCliente: a.nomeCliente,
    whatsappCliente: a.whatsappCliente,
    dataHora: a.dataHora.toISOString(),
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}
