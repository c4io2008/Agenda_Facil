import { painelEditavel } from '../../domain/assinatura';
import type { StatusAgendamento } from '../../domain/entidades';
import { NaoEncontradoError, PainelSomenteLeituraError, TransicaoDeStatusInvalidaError } from '../../domain/errors';
import { POLITICA_PLANOS } from '../../domain/politica-planos';
import { agendamentoParaDTO } from '../contexto';
import type { Relogio, UnitOfWork } from '../ports';

export class ConsultarAgendamentoUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(codigo: string) {
    const a = await this.uow.repos.agendamentos.buscarPorCodigo(codigo);
    if (!a) throw new NaoEncontradoError('Agendamento não encontrado');
    return {
      id: a.id,
      codigo: a.codigo,
      status: a.status,
      dataHora: a.dataHora.toISOString(),
      nomeCliente: a.nomeCliente,
      servico: { nome: a.servicoNome, duracaoMinutos: a.servicoDuracaoMinutos },
      profissional: { nome: a.profissionalNome },
      estabelecimento: { nome: a.estabelecimentoNome, slug: a.estabelecimentoSlug },
    };
  }
}

export class AtualizarStatusAgendamentoUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  /** `estabelecimentoId` só é informado quando há JWT de Contratante (vem do token, nunca do body). */
  async executar(i: { codigo: string; status: StatusAgendamento; estabelecimentoId?: string }) {
    return this.uow.executar(async (repos) => {
      const a = await repos.agendamentos.buscarPorCodigo(i.codigo, i.estabelecimentoId);
      if (!a) throw new NaoEncontradoError('Agendamento não encontrado');

      if (i.estabelecimentoId) {
        const est = await repos.estabelecimentos.buscarPorId(i.estabelecimentoId);
        const ass = await repos.assinaturas.buscarPorEstabelecimento(i.estabelecimentoId);
        if (!est || !painelEditavel(est, ass)) throw new PainelSomenteLeituraError();
      }

      // RN-04: só CONFIRMADO -> CANCELADO. (CB-03: cancelar de novo também é transição inválida.)
      if (!(a.status === 'CONFIRMADO' && i.status === 'CANCELADO')) throw new TransicaoDeStatusInvalidaError();

      const atualizado = await repos.agendamentos.atualizarStatus(a.id, 'CANCELADO');
      await repos.notificacoes.descartarPendentes(a.id, ['CONFIRMACAO', 'LEMBRETE']);
      if (POLITICA_PLANOS[a.estabelecimentoPlano].whatsapp) {
        await repos.notificacoes.criar(a.id, 'CANCELAMENTO', this.relogio.agora());
      }
      return agendamentoParaDTO(atualizado);
    });
  }
}
