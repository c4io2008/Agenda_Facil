import { CredenciaisInvalidasError } from '../../domain/errors';
import type { EmissorToken, HasherSenha, UnitOfWork } from '../ports';

abstract class AutenticadorBase {
  private hashFalso?: Promise<string>;
  constructor(protected hasher: HasherSenha) {}

  /** Gasta o mesmo tempo de um bcrypt real quando o e-mail não existe. */
  protected async comparar(senha: string, hash: string | null): Promise<boolean> {
    if (hash) return this.hasher.comparar(senha, hash);
    this.hashFalso ??= this.hasher.gerar('senha-falsa-para-igualar-tempo');
    await this.hasher.comparar(senha, await this.hashFalso);
    return false;
  }
}

export class AutenticarContratanteUseCase extends AutenticadorBase {
  constructor(private uow: UnitOfWork, hasher: HasherSenha, private tokens: EmissorToken) {
    super(hasher);
  }

  async executar(email: string, senha: string) {
    const est = await this.uow.repos.estabelecimentos.buscarPorEmail(email.trim().toLowerCase());
    const ok = await this.comparar(senha, est?.senhaHash ?? null);
    if (!est || !ok) throw new CredenciaisInvalidasError();
    const { token, expiraEm } = this.tokens.emitir({ tipo: 'CONTRATANTE', sub: est.id, estabelecimentoId: est.id });
    return { token, expiraEm: expiraEm.toISOString() };
  }
}

export class AutenticarPlataformaUseCase extends AutenticadorBase {
  constructor(private uow: UnitOfWork, hasher: HasherSenha, private tokens: EmissorToken) {
    super(hasher);
  }

  async executar(email: string, senha: string) {
    const u = await this.uow.repos.plataforma.buscarUsuarioPorEmail(email.trim().toLowerCase());
    const ok = await this.comparar(senha, u?.senhaHash ?? null);
    if (!u || !ok) throw new CredenciaisInvalidasError();
    const { token, expiraEm } = this.tokens.emitir({ tipo: 'PLATAFORMA', sub: u.id, papel: u.papel });
    return { token, expiraEm: expiraEm.toISOString() };
  }
}
