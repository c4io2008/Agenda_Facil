import { POLITICA_PLANOS } from '../../domain/politica-planos';
import { calcularHorarios } from '../../domain/grade';
import { limitesUTC } from '../../domain/grade';
import { NaoEncontradoError } from '../../domain/errors';
import { carregarContextoPublico } from '../contexto';
import type { Relogio, UnitOfWork } from '../ports';

export class ObterPaginaPublicaUseCase {
  constructor(private uow: UnitOfWork) {}

  async executar(slug: string) {
    const { repos } = this.uow;
    const { est } = await carregarContextoPublico(repos, slug);
    const exibeCatalogo = est.catalogoPublico && POLITICA_PLANOS[est.plano].catalogoPublico;
    const [servicos, profissionais, horariosFuncionamento] = await Promise.all([
      repos.servicos.listar(est.id, true),
      repos.profissionais.listar(est.id, true),
      repos.estabelecimentos.listarHorariosFuncionamento(est.id),
    ]);
    return {
      id: est.id,
      nome: est.nome,
      slug: est.slug,
      fusoHorario: est.fusoHorario,
      tituloAgenda: est.tituloAgenda,
      mensagemCancelamento: est.mensagemCancelamento || 'Cancelamentos devem ser solicitados com pelo menos 2 dias de antecedência. Não é permitido cancelar no dia do agendamento.',
      horariosFuncionamento,
      tema: est.tema,
      logoUrl: POLITICA_PLANOS[est.plano].logoPersonalizada ? est.logoUrl : null,
      catalogoPublico: exibeCatalogo,
      whatsapp: POLITICA_PLANOS[est.plano].whatsapp,
      servicos: servicos.map((s) =>
        exibeCatalogo
          ? { id: s.id, nome: s.nome, preco: s.preco, duracaoMinutos: s.duracaoMinutos, fotoUrl: s.fotoUrl, descricao: s.descricao }
          : { id: s.id, nome: s.nome, duracaoMinutos: s.duracaoMinutos },
      ),
      profissionais: profissionais.map((p) => ({ id: p.id, nome: p.nome, servicoIds: p.servicoIds })),
    };
  }
}

export class CalcularHorariosDisponiveisUseCase {
  constructor(private uow: UnitOfWork, private relogio: Relogio) {}

  async executar(i: { slug: string; profissionalId: string; servicoId: string; data: string }) {
    const { repos } = this.uow;
    const { est } = await carregarContextoPublico(repos, i.slug);
    const [prof, serv] = await Promise.all([
      repos.profissionais.buscarPorId(est.id, i.profissionalId),
      repos.servicos.buscarPorId(est.id, i.servicoId),
    ]);
    if (!prof || !prof.ativo) throw new NaoEncontradoError('Profissional não encontrado');
    if (!serv || !serv.ativo) throw new NaoEncontradoError('Serviço não encontrado');
    if (!prof.servicoIds.includes(serv.id)) return { data: i.data, horarios: [] as string[] };

    const { de, ate } = limitesUTC(i.data, i.data, est.fusoHorario);
    const [funcionamento, ocupados] = await Promise.all([
      repos.estabelecimentos.listarHorariosFuncionamento(est.id),
      repos.agendamentos.listarOcupados(est.id, prof.id, de, ate),
    ]);
    const horarios = calcularHorarios({
      data: i.data,
      fuso: est.fusoHorario,
      intervaloMinutos: est.intervaloGradeMinutos,
      funcionamento,
      atendimento: prof.horariosAtendimento,
      duracaoMinutos: serv.duracaoMinutos,
      ocupados,
      agora: this.relogio.agora(),
    });
    return { data: i.data, horarios };
  }
}
