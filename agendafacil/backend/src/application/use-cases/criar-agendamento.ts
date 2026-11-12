import { randomInt } from 'node:crypto';
import { ALFABETO_CODIGO, aceitaNovosAgendamentos } from '../../domain/assinatura';
import {
  AssinaturaInativaError, HorarioIndisponivelError, NaoEncontradoError,
  ProfissionalNaoRealizaServicoError, ValidacaoDominioError,
} from '../../domain/errors';
import { POLITICA_PLANOS } from '../../domain/politica-planos';
import { calcularSlots, dataLocal, limitesUTC } from '../../domain/grade';
import { agendamentoParaDTO } from '../contexto';
import type { Config, GeradorCodigo, Relogio, UnitOfWork } from '../ports';

export class GeradorCodigoAleatorio implements GeradorCodigo {
  gerar(): string {
    let c = '';
    for (let i = 0; i < 8; i++) c += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
    return c;
  }
}

export interface EntradaAgendamento {
  estabelecimentoId: string;
  profissionalId: string;
  servicoId: string;
  nomeCliente: string;
  whatsappCliente: string;
  dataHora: Date;
}

export class CriarAgendamentoUseCase {
  constructor(
    private uow: UnitOfWork,
    private relogio: Relogio,
    private codigos: GeradorCodigo,
    private config: Config,
  ) {}

  async executar(i: EntradaAgendamento) {
    const agora = this.relogio.agora();
    if (i.dataHora.getTime() <= agora.getTime()) {
      throw new ValidacaoDominioError('A data do agendamento não pode ser no passado.', [
        { campo: 'dataHora', mensagem: 'A data do agendamento não pode ser no passado.' },
      ]);
    }

    return this.uow.executar(async (repos) => {
      const est = await repos.estabelecimentos.buscarPorId(i.estabelecimentoId);
      if (!est || est.status === 'CANCELADO') throw new NaoEncontradoError('Estabelecimento não encontrado');
      const assinatura = await repos.assinaturas.buscarPorEstabelecimento(est.id);
      if (!aceitaNovosAgendamentos(est, assinatura)) throw new AssinaturaInativaError();

      // Bloqueia o profissional ANTES de ler a agenda: a 2ª transação concorrente espera e enxerga o commit da 1ª.
      const prof = await repos.profissionais.buscarPorId(est.id, i.profissionalId);
      if (!prof) throw new NaoEncontradoError('Profissional não encontrado');
      const serv = await repos.servicos.buscarPorId(est.id, i.servicoId);
      if (!serv) throw new NaoEncontradoError('Serviço não encontrado');
      if (!prof.ativo || !serv.ativo) {
        throw new ValidacaoDominioError('Profissional e serviço precisam estar ativos.', [
          { campo: 'profissionalId', mensagem: 'Profissional ou serviço inativo.' },
        ]);
      }
      if (!prof.servicoIds.includes(serv.id)) throw new ProfissionalNaoRealizaServicoError();

      await repos.profissionais.bloquear(est.id, prof.id);

      const data = dataLocal(i.dataHora, est.fusoHorario);
      const { de, ate } = limitesUTC(data, data, est.fusoHorario);
      const [funcionamento, ocupados] = await Promise.all([
        repos.estabelecimentos.listarHorariosFuncionamento(est.id),
        repos.agendamentos.listarOcupados(est.id, prof.id, de, ate),
      ]);
      const slots = calcularSlots({
        data,
        fuso: est.fusoHorario,
        intervaloMinutos: est.intervaloGradeMinutos,
        funcionamento,
        atendimento: prof.horariosAtendimento,
        duracaoMinutos: serv.duracaoMinutos,
        ocupados,
        agora,
      });
      if (!slots.some((s) => s.inicio.getTime() === i.dataHora.getTime())) throw new HorarioIndisponivelError();

      const codigo = await this.gerarCodigoUnico(repos.agendamentos.codigoExiste.bind(repos.agendamentos));
      const ag = await repos.agendamentos.criar({
        codigo,
        estabelecimentoId: est.id,
        profissionalId: prof.id,
        servicoId: serv.id,
        nomeCliente: i.nomeCliente.trim(),
        whatsappCliente: i.whatsappCliente,
        dataHora: i.dataHora,
        status: 'CONFIRMADO',
      });

      // Envio é assíncrono: apenas enfileira (RNF08). Só planos com WhatsApp geram notificação.
      if (POLITICA_PLANOS[est.plano].whatsapp) {
        await repos.notificacoes.criar(ag.id, 'CONFIRMACAO', agora);
        const lembreteEm = new Date(i.dataHora.getTime() - this.config.lembreteAntecedenciaHoras * 3_600_000);
        if (lembreteEm.getTime() > agora.getTime()) await repos.notificacoes.criar(ag.id, 'LEMBRETE', lembreteEm);
      }
      return agendamentoParaDTO(ag);
    });
  }

  private async gerarCodigoUnico(existe: (c: string) => Promise<boolean>): Promise<string> {
    for (let t = 0; t < 8; t++) {
      const c = this.codigos.gerar();
      if (!(await existe(c))) return c;
    }
    throw new Error('Não foi possível gerar um código único de agendamento');
  }
}
