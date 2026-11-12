import { POLITICA_PLANOS, type Plano } from '../../domain/politica-planos';
import type { Assinatura } from '../../domain/entidades';
import { MudancaDePlanoInvalidaError, NaoEncontradoError } from '../../domain/errors';
import { paraDataISO } from '../../domain/datas';
import { exigirEstabelecimento } from '../contexto';
import type { Relogio, UnitOfWork } from '../ports';

async function exigirAssinatura(uow: UnitOfWork, estabelecimentoId: string): Promise<Assinatura> {
  const a = await uow.repos.assinaturas.buscarPorEstabelecimento(estabelecimentoId);
  if (!a) throw new NaoEncontradoError('Assinatura não encontrada');
  return a;
}

export class ObterAssinaturaUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(estabelecimentoId: string) {
    const a = await exigirAssinatura(this.uow, estabelecimentoId);
    const pol = POLITICA_PLANOS[a.plano];
    return {
      plano: a.plano,
      status: a.status,
      valorMensal: a.valorMensal,
      proximaCobranca: a.proximaCobranca ? paraDataISO(a.proximaCobranca) : null,
      planoAgendado: a.planoAgendado,
      cancelamentoAgendado: a.cancelarNoFimDoCiclo,
      recursos: { agenda: true, whatsapp: pol.whatsapp, catalogoPublico: pol.catalogoPublico, logoPersonalizada: pol.logoPersonalizada },
      planosDisponiveis: (Object.keys(POLITICA_PLANOS) as Plano[]).map((p) => ({ plano: p, ...POLITICA_PLANOS[p] })),
    };
  }
}

/** RN-14: upgrade imediato; downgrade agendado para o fim do ciclo. */
export class MudarPlanoUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  async executar(estabelecimentoId: string, novoPlano: Plano) {
    return this.uow.executar(async (repos) => {
      const est = await exigirEstabelecimento(repos, estabelecimentoId);
      const ass = await repos.assinaturas.buscarPorEstabelecimento(estabelecimentoId);
      if (!ass) throw new NaoEncontradoError('Assinatura não encontrada');
      if (ass.status === 'CANCELADA' || est.status === 'CANCELADO') {
        throw new MudancaDePlanoInvalidaError('Assinatura cancelada não aceita mudança de plano.');
      }
      if (novoPlano === ass.plano) throw new MudancaDePlanoInvalidaError('Você já está neste plano.');

      const novoValor = POLITICA_PLANOS[novoPlano].preco;
      if (novoValor > POLITICA_PLANOS[ass.plano].preco) {
        const agora = this.relogio.agora();
        await repos.assinaturas.atualizar(estabelecimentoId, {
          plano: novoPlano,
          valorMensal: novoValor,
          planoAgendado: null,
          cancelarNoFimDoCiclo: false,
        });
        await repos.estabelecimentos.atualizar(estabelecimentoId, { plano: novoPlano });
        return { plano: novoPlano, efetivoEm: agora.toISOString(), valorMensal: novoValor, tipo: 'UPGRADE' as const };
      }

      await repos.assinaturas.atualizar(estabelecimentoId, { planoAgendado: novoPlano });
      const fimCiclo = ass.proximaCobranca ?? this.relogio.agora();
      return { plano: novoPlano, efetivoEm: fimCiclo.toISOString(), valorMensal: novoValor, tipo: 'DOWNGRADE' as const };
    });
  }
}

export class CancelarAssinaturaUseCase {
  constructor(private uow: UnitOfWork) {}

  /** RN-17: mantém o serviço até o fim do ciclo pago. */
  async executar(estabelecimentoId: string) {
    const ass = await exigirAssinatura(this.uow, estabelecimentoId);
    if (ass.status === 'CANCELADA') throw new MudancaDePlanoInvalidaError('A assinatura já está cancelada.');
    await this.uow.repos.assinaturas.atualizar(estabelecimentoId, { cancelarNoFimDoCiclo: true, planoAgendado: null });
    return { cancelamentoEm: ass.proximaCobranca ? paraDataISO(ass.proximaCobranca) : null };
  }
}

export class ListarCobrancasUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(estabelecimentoId: string) {
    const cobrancas = await this.uow.repos.cobrancas.listarPorEstabelecimento(estabelecimentoId);
    return {
      itens: cobrancas.map((c) => ({
        id: c.id,
        valor: c.valor,
        vencimento: paraDataISO(c.vencimento),
        status: c.status,
        pagoEm: c.pagoEm?.toISOString() ?? null,
      })),
    };
  }
}
