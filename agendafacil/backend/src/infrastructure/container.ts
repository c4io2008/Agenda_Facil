import type { PrismaClient } from '@prisma/client';
import type { Env } from '../config';
import type {
  Config, EmissorToken, GeradorCodigo, HasherSenha, ProvedorPagamento, Relogio, UnitOfWork, WhatsAppGateway,
} from '../application/ports';
import { AutenticarContratanteUseCase, AutenticarPlataformaUseCase } from '../application/use-cases/autenticar';
import { CadastrarEstabelecimentoUseCase } from '../application/use-cases/cadastrar-estabelecimento';
import {
  AtualizarEstabelecimentoUseCase, ObterEstabelecimentoUseCase, SubstituirHorariosFuncionamentoUseCase,
} from '../application/use-cases/estabelecimento-contratante';
import { CalcularHorariosDisponiveisUseCase, ObterPaginaPublicaUseCase } from '../application/use-cases/pagina-publica';
import { CriarAgendamentoUseCase, GeradorCodigoAleatorio } from '../application/use-cases/criar-agendamento';
import { AtualizarStatusAgendamentoUseCase, ConsultarAgendamentoUseCase } from '../application/use-cases/gerenciar-agendamento';
import { GerenciarProfissionaisUseCase, GerenciarServicosUseCase } from '../application/use-cases/gerenciar-catalogo';
import { ConsultarAgendaUseCase } from '../application/use-cases/consultar-agenda';
import {
  CancelarAssinaturaUseCase, ListarCobrancasUseCase, MudarPlanoUseCase, ObterAssinaturaUseCase,
} from '../application/use-cases/assinatura';
import { ProcessarCobrancasUseCase, RegistrarPagamentoUseCase } from '../application/use-cases/processar-cobrancas';
import { EnviarNotificacoesUseCase } from '../application/use-cases/enviar-notificacoes';
import { AlterarStatusEstabelecimentoUseCase, ConsultarPlataformaUseCase } from '../application/use-cases/plataforma';
import { obterPrisma } from './prisma/client';
import { PrismaUnitOfWork } from './prisma/repositorios';
import { BcryptHasher, JwtEmissor } from './security/seguranca';
import { WhatsAppCloudApi, WhatsAppConsole } from './whatsapp/clientes';
import { ProvedorPagamentoFake } from './pagamentos/provedores';

export class RelogioSistema implements Relogio {
  agora() {
    return new Date();
  }
}

export interface Overrides {
  prisma?: PrismaClient;
  relogio?: Relogio;
  whatsapp?: WhatsAppGateway;
  pagamentos?: ProvedorPagamento;
  codigos?: GeradorCodigo;
  hasher?: HasherSenha;
}

export function criarContainer(env: Env, o: Overrides = {}) {
  const prisma = o.prisma ?? obterPrisma();
  const uow: UnitOfWork = new PrismaUnitOfWork(prisma);
  const relogio = o.relogio ?? new RelogioSistema();
  const hasher = o.hasher ?? new BcryptHasher();
  const tokens: EmissorToken = new JwtEmissor(env.JWT_SECRET, env.JWT_EXPIRES_IN);
  const whatsapp =
    o.whatsapp ??
    (env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID
      ? new WhatsAppCloudApi(env.WHATSAPP_API_TOKEN, env.WHATSAPP_PHONE_NUMBER_ID)
      : new WhatsAppConsole());
  const pagamentos = o.pagamentos ?? new ProvedorPagamentoFake(); // PAGAMENTOS_PROVIDER=fake até o gateway ser definido
  const codigos = o.codigos ?? new GeradorCodigoAleatorio();

  const config: Config = {
    lembreteAntecedenciaHoras: env.LEMBRETE_ANTECEDENCIA_HORAS,
    toleranciaDiasAtraso: env.TOLERANCIA_DIAS_ATRASO,
    whatsappRetryMinutos: env.WHATSAPP_RETRY_MINUTOS,
    appPublicUrl: env.APP_PUBLIC_URL,
    maxTentativasWhatsapp: 3,
  };

  const registrarPagamento = new RegistrarPagamentoUseCase(uow, relogio);

  return {
    env,
    prisma,
    tokens,
    uow,
    useCases: {
      cadastrarEstabelecimento: new CadastrarEstabelecimentoUseCase(uow, hasher, relogio),
      autenticarContratante: new AutenticarContratanteUseCase(uow, hasher, tokens),
      autenticarPlataforma: new AutenticarPlataformaUseCase(uow, hasher, tokens),
      obterEstabelecimento: new ObterEstabelecimentoUseCase(uow),
      atualizarEstabelecimento: new AtualizarEstabelecimentoUseCase(uow),
      substituirHorarios: new SubstituirHorariosFuncionamentoUseCase(uow),
      paginaPublica: new ObterPaginaPublicaUseCase(uow),
      horariosDisponiveis: new CalcularHorariosDisponiveisUseCase(uow, relogio),
      criarAgendamento: new CriarAgendamentoUseCase(uow, relogio, codigos, config),
      consultarAgendamento: new ConsultarAgendamentoUseCase(uow),
      atualizarStatusAgendamento: new AtualizarStatusAgendamentoUseCase(uow, relogio),
      servicos: new GerenciarServicosUseCase(uow, relogio),
      profissionais: new GerenciarProfissionaisUseCase(uow, relogio),
      agenda: new ConsultarAgendaUseCase(uow, relogio),
      assinatura: new ObterAssinaturaUseCase(uow),
      mudarPlano: new MudarPlanoUseCase(uow, relogio),
      cancelarAssinatura: new CancelarAssinaturaUseCase(uow),
      cobrancas: new ListarCobrancasUseCase(uow),
      registrarPagamento,
      processarCobrancas: new ProcessarCobrancasUseCase(uow, pagamentos, relogio, config, registrarPagamento),
      enviarNotificacoes: new EnviarNotificacoesUseCase(uow, whatsapp, relogio, config),
      plataforma: new ConsultarPlataformaUseCase(uow, relogio),
      alterarStatusEstabelecimento: new AlterarStatusEstabelecimentoUseCase(uow),
    },
  };
}

export type Container = ReturnType<typeof criarContainer>;
