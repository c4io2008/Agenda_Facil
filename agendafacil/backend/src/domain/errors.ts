export interface DetalheValidacao {
  campo: string;
  mensagem: string;
}

/** Base das exceções de domínio. O middleware central mapeia `status` e `code` para HTTP. */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: DetalheValidacao[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class HorarioIndisponivelError extends DomainError {
  constructor() {
    super('HORARIO_INDISPONIVEL', 'Horário não está mais disponível', 409);
  }
}

export class TransicaoDeStatusInvalidaError extends DomainError {
  constructor() {
    super('INVALID_STATUS_TRANSITION', 'Agendamentos cancelados não podem ser reativados.', 400);
  }
}

export class RecursoIndisponivelNoPlanoError extends DomainError {
  constructor(message = 'O catálogo público está disponível apenas no plano PREMIUM.') {
    super('RECURSO_INDISPONIVEL_NO_PLANO', message, 403);
  }
}

export class AssinaturaInativaError extends DomainError {
  constructor() {
    super('ASSINATURA_INATIVA', 'Agendamento temporariamente indisponível', 403);
  }
}

export class EstabelecimentoJaCadastradoError extends DomainError {
  constructor() {
    super('ESTABELECIMENTO_JA_CADASTRADO', 'CNPJ/CPF, e-mail ou slug já estão em uso.', 409);
  }
}

export class NaoEncontradoError extends DomainError {
  constructor(message = 'Recurso não encontrado') {
    super('NOT_FOUND', message, 404);
  }
}

export class CredenciaisInvalidasError extends DomainError {
  constructor() {
    super('CREDENCIAIS_INVALIDAS', 'E-mail ou senha inválidos.', 401);
  }
}

export class NaoAutenticadoError extends DomainError {
  constructor(message = 'Autenticação necessária.') {
    super('NAO_AUTENTICADO', message, 401);
  }
}

export class AcessoNegadoError extends DomainError {
  constructor(message = 'Você não tem permissão para esta ação.') {
    super('ACESSO_NEGADO', message, 403);
  }
}

export class ProfissionalNaoRealizaServicoError extends DomainError {
  constructor() {
    super('PROFISSIONAL_NAO_REALIZA_SERVICO', 'O profissional não realiza o serviço informado.', 422);
  }
}

export class PossuiAgendamentosFuturosError extends DomainError {
  constructor(entidade: 'profissional' | 'serviço') {
    super(
      'POSSUI_AGENDAMENTOS_FUTUROS',
      `Não é possível excluir: o ${entidade} possui agendamentos futuros. Desative-o.`,
      409,
    );
  }
}

export class MudancaDePlanoInvalidaError extends DomainError {
  constructor(message = 'Mudança de plano inválida.') {
    super('MUDANCA_DE_PLANO_INVALIDA', message, 409);
  }
}

export class PainelSomenteLeituraError extends DomainError {
  constructor() {
    super('ASSINATURA_INATIVA', 'Painel em modo somente leitura. Regularize sua assinatura.', 403);
  }
}

/** Violação de regra de validação detectada no domínio (equivalente ao 422 do Zod). */
export class ValidacaoDominioError extends DomainError {
  constructor(message: string, details?: DetalheValidacao[]) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}
