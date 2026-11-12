import cors from 'cors';
import express from 'express';
import type { Container } from '../../infrastructure/container';
import { naoEncontrada, tratarErros } from './middlewares';
import { rotasContratante } from './routes/contratante';
import { rotasPlataforma } from './routes/plataforma';
import { rotasPublicas } from './routes/publicas';

export function criarApp(c: Container) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: c.env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Ordem importa: /estabelecimentos/me (JWT) antes de /estabelecimentos/:slug (público).
  const api = express.Router();
  api.use(rotasContratante(c));
  api.use(rotasPlataforma(c));
  api.use(rotasPublicas(c));
  app.use('/api/v1', api);

  app.use(naoEncontrada);
  app.use(tratarErros);
  return app;
}
