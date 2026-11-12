import type { JanelaHorario } from '../../domain/entidades';
import { NaoEncontradoError, PossuiAgendamentosFuturosError, ValidacaoDominioError } from '../../domain/errors';
import { exigirPainelEditavel } from '../contexto';
import type { DadosProfissional, DadosServico, Relogio, UnitOfWork } from '../ports';

function validarJanelas(janelas: JanelaHorario[], campo: string) {
  for (const j of janelas) {
    if (j.fim <= j.inicio) {
      throw new ValidacaoDominioError('O fim do horário deve ser depois do início.', [
        { campo, mensagem: 'fim deve ser maior que inicio' },
      ]);
    }
  }
}

export class GerenciarServicosUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  listar(estabelecimentoId: string) {
    return this.uow.repos.servicos.listar(estabelecimentoId);
  }

  async obter(estabelecimentoId: string, id: string) {
    const s = await this.uow.repos.servicos.buscarPorId(estabelecimentoId, id);
    if (!s) throw new NaoEncontradoError('Serviço não encontrado');
    return s;
  }

  async criar(estabelecimentoId: string, dados: DadosServico) {
    await exigirPainelEditavel(this.uow.repos, estabelecimentoId);
    return this.uow.repos.servicos.criar(estabelecimentoId, dados);
  }

  async atualizar(estabelecimentoId: string, id: string, dados: Partial<DadosServico> & { ativo?: boolean }) {
    await exigirPainelEditavel(this.uow.repos, estabelecimentoId);
    await this.obter(estabelecimentoId, id);
    return this.uow.repos.servicos.atualizar(estabelecimentoId, id, dados);
  }

  /** RN-16: com agendamentos CONFIRMADO futuros, 409. Com histórico, desativa em vez de apagar. */
  async excluir(estabelecimentoId: string, id: string): Promise<{ desativado: boolean }> {
    const { repos } = this.uow;
    await exigirPainelEditavel(repos, estabelecimentoId);
    await this.obter(estabelecimentoId, id);
    if ((await repos.servicos.contarAgendamentosFuturos(estabelecimentoId, id, this.relogio.agora())) > 0) {
      throw new PossuiAgendamentosFuturosError('serviço');
    }
    try {
      await repos.servicos.excluir(estabelecimentoId, id);
      return { desativado: false };
    } catch {
      // FK RESTRICT: há histórico de agendamentos. Preserva-o desativando.
      await repos.servicos.atualizar(estabelecimentoId, id, { ativo: false });
      return { desativado: true };
    }
  }
}

export class GerenciarProfissionaisUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  listar(estabelecimentoId: string) {
    return this.uow.repos.profissionais.listar(estabelecimentoId);
  }

  async obter(estabelecimentoId: string, id: string) {
    const p = await this.uow.repos.profissionais.buscarPorId(estabelecimentoId, id);
    if (!p) throw new NaoEncontradoError('Profissional não encontrado');
    return p;
  }

  private async validarServicos(estabelecimentoId: string, ids: string[]) {
    const unicos = [...new Set(ids)];
    if (unicos.length && (await this.uow.repos.servicos.contarPorIds(estabelecimentoId, unicos)) !== unicos.length) {
      throw new ValidacaoDominioError('Um ou mais serviços não pertencem ao estabelecimento.', [
        { campo: 'servicoIds', mensagem: 'Serviço inválido.' },
      ]);
    }
    return unicos;
  }

  async criar(estabelecimentoId: string, dados: DadosProfissional) {
    await exigirPainelEditavel(this.uow.repos, estabelecimentoId);
    validarJanelas(dados.horariosAtendimento, 'horariosAtendimento');
    const servicoIds = await this.validarServicos(estabelecimentoId, dados.servicoIds);
    return this.uow.repos.profissionais.criar(estabelecimentoId, { ...dados, servicoIds });
  }

  async atualizar(estabelecimentoId: string, id: string, dados: Partial<DadosProfissional> & { ativo?: boolean }) {
    await exigirPainelEditavel(this.uow.repos, estabelecimentoId);
    await this.obter(estabelecimentoId, id);
    if (dados.horariosAtendimento) validarJanelas(dados.horariosAtendimento, 'horariosAtendimento');
    const servicoIds = dados.servicoIds ? await this.validarServicos(estabelecimentoId, dados.servicoIds) : undefined;
    return this.uow.repos.profissionais.atualizar(estabelecimentoId, id, { ...dados, servicoIds });
  }

  async excluir(estabelecimentoId: string, id: string): Promise<{ desativado: boolean }> {
    const { repos } = this.uow;
    await exigirPainelEditavel(repos, estabelecimentoId);
    await this.obter(estabelecimentoId, id);
    if ((await repos.profissionais.contarAgendamentosFuturos(estabelecimentoId, id, this.relogio.agora())) > 0) {
      throw new PossuiAgendamentosFuturosError('profissional');
    }
    try {
      await repos.profissionais.excluir(estabelecimentoId, id);
      return { desativado: false };
    } catch {
      await repos.profissionais.atualizar(estabelecimentoId, id, { ativo: false });
      return { desativado: true };
    }
  }
}
