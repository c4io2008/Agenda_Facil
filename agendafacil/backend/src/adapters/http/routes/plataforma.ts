import { Router } from 'express';
import type { Container } from '../../../infrastructure/container';
import {
  idParams, loginSchema, plataformaListaQuery, plataformaStatusSchema, webhookPagamentoSchema,
} from '../schemas';
import { autenticarPlataforma, autenticarWebhook, h, limitador, validar } from '../middlewares';

export function rotasPlataforma(c: Container): Router {
  const r = Router();
  const u = c.useCases;
  const auth = autenticarPlataforma(c.tokens);

  r.post('/plataforma/auth/login', limitador(20), validar({ body: loginSchema }), h(async (req, res) => {
    res.json(await u.autenticarPlataforma.executar(req.body.email, req.body.senha));
  }));

  r.get('/plataforma/estabelecimentos', auth, validar({ query: plataformaListaQuery }), h(async (req, res) => {
    res.json(await u.plataforma.listar(req.query as never));
  }));
  r.get('/plataforma/estabelecimentos/:id', auth, validar({ params: idParams }), h(async (req, res) => {
    res.json(await u.plataforma.detalhe(req.params.id));
  }));
  r.patch('/plataforma/estabelecimentos/:id/status', auth, validar({ params: idParams, body: plataformaStatusSchema }), h(async (req, res) => {
    res.json(await u.alterarStatusEstabelecimento.executar(req.usuarioPlataforma!, req.params.id, req.body.status));
  }));
  r.get('/plataforma/metricas', auth, h(async (req, res) => {
    res.json(await u.plataforma.metricas(req.usuarioPlataforma!));
  }));

  // Retorno do gateway (segredo compartilhado em PAGAMENTOS_API_KEY).
  r.post('/webhooks/pagamentos', autenticarWebhook(c.env.PAGAMENTOS_API_KEY), validar({ body: webhookPagamentoSchema }), h(async (req, res) => {
    res.json(await u.registrarPagamento.executar(req.body));
  }));

  return r;
}
