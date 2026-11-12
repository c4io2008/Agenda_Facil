import { DateTime } from 'luxon';
import { POLITICA_PLANOS } from '../../domain/politica-planos';
import { limitesUTC } from '../../domain/grade';
import { ValidacaoDominioError } from '../../domain/errors';
import { exigirEstabelecimento } from '../contexto';
import type { Relogio, UnitOfWork } from '../ports';

const MAX_DIAS = 62;

export class ConsultarAgendaUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  /** Leitura sempre permitida, inclusive com assinatura SUSPENSA (RN-08, Cenário 9). */
  async agenda(estabelecimentoId: string, i: { inicio: string; fim: string; profissionalId?: string }) {
    const { repos } = this.uow;
    const est = await exigirEstabelecimento(repos, estabelecimentoId);
    const dias = DateTime.fromISO(i.fim).diff(DateTime.fromISO(i.inicio), 'days').days;
    if (dias < 0 || dias > MAX_DIAS) {
      throw new ValidacaoDominioError(`O período deve ter entre 0 e ${MAX_DIAS} dias.`, [
        { campo: 'fim', mensagem: 'Período inválido.' },
      ]);
    }
    const { de, ate } = limitesUTC(i.inicio, i.fim, est.fusoHorario);
    const itens = await repos.agendamentos.listarAgenda(est.id, de, ate, i.profissionalId);
    const comWhatsapp = POLITICA_PLANOS[est.plano].whatsapp;

    return {
      itens: itens.map((it) => {
        let whatsapp: { status: string; ultimoErro: string | null } | null = null;
        if (comWhatsapp && it.notificacoes.length) {
          const falha = it.notificacoes.find((n) => n.status === 'FALHA');
          const alvo =
            falha ?? [...it.notificacoes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
          whatsapp = { status: alvo.status, ultimoErro: alvo.ultimoErro };
        }
        return {
          codigo: it.codigo,
          nomeCliente: it.nomeCliente,
          servico: it.servico,
          profissional: it.profissional,
          dataHora: it.dataHora.toISOString(),
          status: it.status,
          whatsapp,
        };
      }),
    };
  }

  async metricas(estabelecimentoId: string, data?: string) {
    const { repos } = this.uow;
    const est = await exigirEstabelecimento(repos, estabelecimentoId);
    const dia = data ?? DateTime.fromJSDate(this.relogio.agora(), { zone: est.fusoHorario }).toFormat('yyyy-MM-dd');
    const { de, ate } = limitesUTC(dia, dia, est.fusoHorario);
    const { confirmados, cancelados } = await repos.agendamentos.contarPorStatus(est.id, de, ate);
    return { data: dia, total: confirmados + cancelados, confirmados, cancelados };
  }
}
