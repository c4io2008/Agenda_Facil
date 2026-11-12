import { POLITICA_PLANOS } from '../../domain/politica-planos';
import { diasEntre, inicioDoDiaUTC, somarMesesUTC } from '../../domain/datas';
import { NaoEncontradoError } from '../../domain/errors';
import type { Config, ProvedorPagamento, Relogio, UnitOfWork } from '../ports';

export interface ResumoCobrancas {
  geradas: number;
  entraramEmAtraso: number;
  suspensas: number;
  canceladas: number;
  downgradesAplicados: number;
}

/** Job diário (RF12, RN-14, RN-15, RN-17). Operação de sistema: percorre todos os tenants. */
export class ProcessarCobrancasUseCase {
  constructor(
    private uow: UnitOfWork,
    private provedor: ProvedorPagamento,
    private relogio: Relogio,
    private config: Config,
    private pagamento: RegistrarPagamentoUseCase,
  ) {}

  async executar(): Promise<ResumoCobrancas> {
    const hoje = inicioDoDiaUTC(this.relogio.agora());
    const r: ResumoCobrancas = { geradas: 0, entraramEmAtraso: 0, suspensas: 0, canceladas: 0, downgradesAplicados: 0 };
    const { repos } = this.uow;

    // 1) Ciclo vencido: cancela, aplica downgrade agendado e gera a nova cobrança.
    for (const ass of await repos.assinaturas.listarComCicloVencido(hoje)) {
      const estId = ass.estabelecimentoId;

      if (ass.cancelarNoFimDoCiclo) {
        await this.uow.executar(async (tx) => {
          await tx.assinaturas.atualizar(estId, { status: 'CANCELADA', proximaCobranca: null, cancelarNoFimDoCiclo: false });
          await tx.estabelecimentos.atualizar(estId, { status: 'CANCELADO' });
        });
        r.canceladas++;
        continue;
      }

      let plano = ass.plano;
      let valor = ass.valorMensal;
      const vencimento = ass.proximaCobranca ?? hoje;

      await this.uow.executar(async (tx) => {
        if (ass.planoAgendado) {
          plano = ass.planoAgendado;
          valor = POLITICA_PLANOS[plano].preco;
          await tx.estabelecimentos.atualizar(estId, {
            plano,
            // Recursos perdidos no downgrade são desativados quando ele passa a valer.
            ...(POLITICA_PLANOS[plano].catalogoPublico ? {} : { catalogoPublico: false }),
            ...(POLITICA_PLANOS[plano].logoPersonalizada ? {} : { logoUrl: null }),
          });
          r.downgradesAplicados++;
        }
        await tx.assinaturas.atualizar(estId, {
          plano,
          valorMensal: valor,
          planoAgendado: null,
          proximaCobranca: somarMesesUTC(vencimento, 1),
        });
      });

      const resultado = await this.provedor.cobrar({ assinaturaId: ass.id, estabelecimentoId: estId, valor, vencimento });
      const cobranca = await repos.cobrancas.criar({
        assinaturaId: ass.id,
        valor,
        vencimento,
        status: 'PENDENTE',
        referenciaExterna: resultado.referenciaExterna,
      });
      r.geradas++;
      if (resultado.status === 'PAGA') await this.pagamento.executar({ referenciaExterna: resultado.referenciaExterna });
      else if (resultado.status === 'FALHA') await repos.cobrancas.marcarFalha(cobranca.id);
    }

    // 2) Inadimplência progressiva.
    const vencidas = await repos.cobrancas.listarEmAbertoVencidas(hoje);
    const tratadas = new Set<string>();
    for (const c of vencidas) {
      if (tratadas.has(c.estabelecimentoId)) continue;
      tratadas.add(c.estabelecimentoId);
      const dias = diasEntre(c.vencimento, hoje);
      if (c.assinaturaStatus === 'ATIVA') {
        await repos.assinaturas.atualizar(c.estabelecimentoId, { status: 'EM_ATRASO' });
        r.entraramEmAtraso++;
      }
      if (c.assinaturaStatus !== 'SUSPENSA' && dias >= this.config.toleranciaDiasAtraso) {
        await this.uow.executar(async (tx) => {
          await tx.assinaturas.atualizar(c.estabelecimentoId, { status: 'SUSPENSA' });
          await tx.estabelecimentos.atualizar(c.estabelecimentoId, { status: 'SUSPENSO' });
        });
        r.suspensas++;
      }
    }
    return r;
  }
}

/** Webhook/consulta do provedor: marca a cobrança como paga e reativa a conta automaticamente. */
export class RegistrarPagamentoUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  async executar(i: { referenciaExterna: string }) {
    return this.uow.executar(async (repos) => {
      const c = await repos.cobrancas.buscarPorReferencia(i.referenciaExterna);
      if (!c) throw new NaoEncontradoError('Cobrança não encontrada');
      if (c.status === 'PAGA') return { status: 'PAGA' as const };

      await repos.cobrancas.marcarPaga(c.id, this.relogio.agora());
      const ass = await repos.assinaturas.buscarPorEstabelecimento(c.estabelecimentoId);
      if (ass && (ass.status === 'EM_ATRASO' || ass.status === 'SUSPENSA')) {
        const estavaSuspensa = ass.status === 'SUSPENSA';
        await repos.assinaturas.atualizar(c.estabelecimentoId, { status: 'ATIVA' });
        if (estavaSuspensa) await repos.estabelecimentos.atualizar(c.estabelecimentoId, { status: 'ATIVO' });
      }
      return { status: 'PAGA' as const };
    });
  }
}
