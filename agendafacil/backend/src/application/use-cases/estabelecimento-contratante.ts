import { POLITICA_PLANOS } from '../../domain/politica-planos';
import type { Estabelecimento, JanelaHorario } from '../../domain/entidades';
import { EstabelecimentoJaCadastradoError, RecursoIndisponivelNoPlanoError, ValidacaoDominioError } from '../../domain/errors';
import { exigirEstabelecimento, exigirPainelEditavel } from '../contexto';
import type { DadosEstabelecimento, UnitOfWork } from '../ports';

function paraDTO(e: Estabelecimento, horarios: JanelaHorario[]) {
  const pol = POLITICA_PLANOS[e.plano];
  return {
    id: e.id,
    nome: e.nome,
    slug: e.slug,
    cnpjCpf: e.cnpjCpf,
    email: e.email,
    telefone: e.telefone,
    plano: e.plano,
    status: e.status,
    catalogoPublico: e.catalogoPublico,
    fusoHorario: e.fusoHorario,
    intervaloGradeMinutos: e.intervaloGradeMinutos,
    tituloAgenda: e.tituloAgenda,
    mensagemCancelamento: e.mensagemCancelamento,
    logoUrl: e.logoUrl,
    logoPosX: e.logoPosX,
    logoPosY: e.logoPosY,
    logoZoom: e.logoZoom,
    tema: e.tema,
    recursos: { whatsapp: pol.whatsapp, catalogoPublico: pol.catalogoPublico, logoPersonalizada: pol.logoPersonalizada },
    horariosFuncionamento: horarios,
  };
}

export class ObterEstabelecimentoUseCase {
  constructor(private uow: UnitOfWork) {}
  async executar(estabelecimentoId: string) {
    const est = await exigirEstabelecimento(this.uow.repos, estabelecimentoId);
    const horarios = await this.uow.repos.estabelecimentos.listarHorariosFuncionamento(est.id);
    return paraDTO(est, horarios);
  }
}

export class AtualizarEstabelecimentoUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(estabelecimentoId: string, dados: DadosEstabelecimento) {
    const { repos } = this.uow;
    const atual = await exigirPainelEditavel(repos, estabelecimentoId);

    // RN-07: catálogo só em planos cuja política permite.
    if (dados.catalogoPublico === true && !POLITICA_PLANOS[atual.plano].catalogoPublico) {
      throw new RecursoIndisponivelNoPlanoError();
    }
    // Logo personalizada só nos planos que a incluem (remover a logo é sempre permitido).
    if (dados.logoUrl && !POLITICA_PLANOS[atual.plano].logoPersonalizada) {
      throw new RecursoIndisponivelNoPlanoError('A logo personalizada está disponível nos planos Profissional e Premium.');
    }
    const slugAlterado = dados.slug !== undefined && dados.slug !== atual.slug;
    if (slugAlterado) {
      const outro = await repos.estabelecimentos.buscarPorSlug(dados.slug!);
      if (outro && outro.id !== atual.id) throw new EstabelecimentoJaCadastradoError();
    }
    // Campos de plano/status nunca são alterados por esta rota.
    const { plano: _p, status: _s, ...seguro } = dados;
    const atualizado = await repos.estabelecimentos.atualizar(atual.id, seguro);
    const horarios = await repos.estabelecimentos.listarHorariosFuncionamento(atual.id);
    return { ...paraDTO(atualizado, horarios), slugAlterado };
  }
}

export class SubstituirHorariosFuncionamentoUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(estabelecimentoId: string, janelas: JanelaHorario[]) {
    const { repos } = this.uow;
    await exigirPainelEditavel(repos, estabelecimentoId);
    for (const j of janelas) {
      if (j.fim <= j.inicio) {
        throw new ValidacaoDominioError('O horário de fechamento deve ser depois da abertura.', [
          { campo: 'horariosFuncionamento', mensagem: 'fecha deve ser maior que abre' },
        ]);
      }
    }
    await repos.estabelecimentos.substituirHorariosFuncionamento(estabelecimentoId, janelas);
    return { horariosFuncionamento: janelas };
  }
}
