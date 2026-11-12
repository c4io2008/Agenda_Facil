import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NaoAutenticadoError } from '../../domain/errors';
import type { EmissorToken, HasherSenha, PayloadToken } from '../../application/ports';

export class BcryptHasher implements HasherSenha {
  constructor(private rounds = process.env.NODE_ENV === 'test' ? 4 : 10) {}
  gerar(senha: string) {
    return bcrypt.hash(senha, this.rounds);
  }
  comparar(senha: string, hash: string) {
    return bcrypt.compare(senha, hash);
  }
}

export class JwtEmissor implements EmissorToken {
  constructor(private segredo: string, private expiraEm: string) {}

  emitir(payload: PayloadToken) {
    const token = jwt.sign(payload, this.segredo, { expiresIn: this.expiraEm as jwt.SignOptions['expiresIn'] });
    const { exp } = jwt.decode(token) as { exp: number };
    return { token, expiraEm: new Date(exp * 1000) };
  }

  verificar(token: string): PayloadToken {
    try {
      const d = jwt.verify(token, this.segredo) as Record<string, unknown>;
      if (d.tipo === 'CONTRATANTE' && typeof d.sub === 'string' && typeof d.estabelecimentoId === 'string') {
        return { tipo: 'CONTRATANTE', sub: d.sub, estabelecimentoId: d.estabelecimentoId };
      }
      if (d.tipo === 'PLATAFORMA' && typeof d.sub === 'string' && (d.papel === 'ADMIN' || d.papel === 'SUPORTE')) {
        return { tipo: 'PLATAFORMA', sub: d.sub, papel: d.papel };
      }
    } catch {
      /* cai no erro padrão abaixo, sem vazar detalhes do JWT */
    }
    throw new NaoAutenticadoError('Token inválido ou expirado.');
  }
}
