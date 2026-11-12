import type { PapelPlataforma, StatusEstabelecimento } from '../../domain/entidades';
import { AcessoNegadoError, NaoEncontradoError, ValidacaoDominioError } from '../../domain/errors';
import { paraDataISO } from '../../domain/datas';
import type { Plano } from '../../domain/politica-planos';
import type { Relogio, UnitOfWork } from '../ports';

export interface UsuarioLogado {
  id: string;
  papel: PapelPlataforma;
}

/** Backoffice: só dados agregados. Nunca nomeCliente/whatsappCliente (RNF05). */
export class ConsultarPlataformaUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  async listar(filtros: { status?: StatusEstabelecimento; plano?: Plano; busca?: string }) {
    const itens = await this.uow.repos.plataforma.listarEstabelecimentos(filtros);
    return {
      itens: itens.map((e) => ({
        ...e,
        proximaCobranca: e.proximaCobranca ? paraDataISO(e.proximaCobranca) : null,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  async detalhe(id: string) {
    const d = await this.uow.repos.plataforma.detalhe(id);
    if (!d) throw new NaoEncontradoError('Estabelecimento não encontrado');
    return {
      ...d.resumo,
      proximaCobranca: d.resumo.proximaCobranca ? paraDataISO(d.resumo.proximaCobranca) : null,
      createdAt: d.resumo.createdAt.toISOString(),
      cobrancas: d.cobrancas.map((c) => ({
        id: c.id, valor: c.valor, vencimento: paraDataISO(c.vencimento), status: c.status,
      })),
      falhasWhatsappRecentes: d.falhasWhatsappRecentes.map((f) => ({ ...f, agendadaPara: f.agendadaPara.toISOString() })),
    };
  }

  async metricas(usuario: UsuarioLogado) {
    if (usuario.papel !== 'ADMIN') throw new AcessoNegadoError();
    return this.uow.repos.plataforma.metricas(this.relogio.agora());
  }
}

export class AlterarStatusEstabelecimentoUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(usuario: UsuarioLogado, id: string, status: 'ATIVO' | 'SUSPENSO') {
    if (usuario.papel !== 'ADMIN') throw new AcessoNegadoError();
    return this.uow.executar(async (repos) => {
      const est = await repos.estabelecimentos.buscarPorId(id);
      if (!est) throw new NaoEncontradoError('Estabelecimento não encontrado');
      if (est.status === 'CANCELADO') {
        throw new ValidacaoDominioError('Contratante cancelado não pode ser alterado.');
      }
      const atualizado = await repos.estabelecimentos.atualizar(id, { status });
      await repos.plataforma.registrarAuditoria({
        usuarioId: usuario.id,
        acao: status === 'SUSPENSO' ? 'SUSPENDER_ESTABELECIMENTO' : 'REATIVAR_ESTABELECIMENTO',
        estabelecimentoId: id,
        detalhe: `${est.status} -> ${status}`,
      });
      return { id: atualizado.id, status: atualizado.status };
    });
  }
}
