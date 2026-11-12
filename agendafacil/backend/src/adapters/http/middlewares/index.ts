import { timingSafeEqual } from 'node:crypto';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError, type ZodTypeAny } from 'zod';
import type { EmissorToken } from '../../../application/ports';
import { AcessoNegadoError, DomainError, NaoAutenticadoError } from '../../../domain/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      contratante?: { id: string; estabelecimentoId: string };
      usuarioPlataforma?: { id: string; papel: 'ADMIN' | 'SUPORTE' };
    }
  }
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

export const h =
  (fn: Handler): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

/** Valida e substitui params/query/body pelos valores já tipados e normalizados pelo Zod. */
export const validar =
  (s: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }): RequestHandler =>
  (req, _res, next) => {
    try {
      if (s.params) req.params = s.params.parse(req.params);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (s.query) (req as any).query = s.query.parse(req.query);
      if (s.body) req.body = s.body.parse(req.body);
      next();
    } catch (e) {
      next(e);
    }
  };

function lerBearer(req: Request): string | null {
  const auth = req.header('authorization');
  if (!auth) return null;
  const [tipo, token] = auth.split(' ');
  return tipo?.toLowerCase() === 'bearer' && token ? token : null;
}

/** O estabelecimentoId SEMPRE vem do JWT, nunca do body (multi-tenancy). */
export const autenticarContratante =
  (tokens: EmissorToken): RequestHandler =>
  (req, _res, next) => {
    try {
      const t = lerBearer(req);
      if (!t) throw new NaoAutenticadoError();
      const p = tokens.verificar(t);
      if (p.tipo !== 'CONTRATANTE') throw new NaoAutenticadoError('Token inválido ou expirado.');
      req.contratante = { id: p.sub, estabelecimentoId: p.estabelecimentoId };
      next();
    } catch (e) {
      next(e);
    }
  };

/** Cancelamento: o `codigo` basta para o Cliente Final; com JWT, o tenant passa a ser restrito. */
export const autenticacaoOpcional =
  (tokens: EmissorToken): RequestHandler =>
  (req, res, next) => {
    if (!lerBearer(req)) return next();
    return autenticarContratante(tokens)(req, res, next);
  };

export const autenticarPlataforma =
  (tokens: EmissorToken): RequestHandler =>
  (req, _res, next) => {
    try {
      const t = lerBearer(req);
      if (!t) throw new NaoAutenticadoError();
      const p = tokens.verificar(t);
      if (p.tipo !== 'PLATAFORMA') throw new AcessoNegadoError();
      req.usuarioPlataforma = { id: p.sub, papel: p.papel };
      next();
    } catch (e) {
      next(e);
    }
  };

export const autenticarWebhook =
  (segredo: string): RequestHandler =>
  (req, _res, next) => {
    const recebido = Buffer.from(req.header('x-webhook-secret') ?? '');
    const esperado = Buffer.from(segredo);
    const ok = segredo.length > 0 && recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
    next(ok ? undefined : new NaoAutenticadoError('Segredo do webhook inválido.'));
  };

export const limitador = (porMinuto: number): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: porMinuto,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: 'MUITAS_REQUISICOES', message: 'Muitas requisições. Tente novamente em instantes.' },
  });

export const naoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada' });
};

export const tratarErros: ErrorRequestHandler = (err, _req, res, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message }));
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: details.length === 1 ? details[0].mensagem : 'Dados inválidos.',
      details,
    });
    return;
  }
  if (err instanceof DomainError) {
    res.status(err.status).json({ error: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON_INVALIDO', message: 'Corpo da requisição não é um JSON válido.' });
    return;
  }
  // Só nome/código do erro: mensagens do Prisma podem embutir valores (dados pessoais).
  console.error('[erro]', err?.name ?? 'Error', err?.code ?? '');
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' });
};
