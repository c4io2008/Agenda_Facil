import { Router } from 'express';
import type { Container } from '../../../infrastructure/container';
import {
  agendamentoSchema, cadastroSchema, codigoParams, horariosQuery, loginSchema, slugParams, statusSchema,
} from '../schemas';
import { autenticacaoOpcional, h, limitador, validar } from '../middlewares';

export function rotasPublicas(c: Container): Router {
  const r = Router();
  const u = c.useCases;

  r.post('/estabelecimentos', limitador(10), validar({ body: cadastroSchema }), h(async (req, res) => {
    res.status(201).json(await u.cadastrarEstabelecimento.executar(req.body));
  }));

  r.post('/auth/login', limitador(20), validar({ body: loginSchema }), h(async (req, res) => {
    res.json(await u.autenticarContratante.executar(req.body.email, req.body.senha));
  }));

  r.get('/estabelecimentos/:slug', limitador(120), validar({ params: slugParams }), h(async (req, res) => {
    res.json(await u.paginaPublica.executar(req.params.slug));
  }));

  r.get('/estabelecimentos/:slug/horarios', limitador(60), validar({ params: slugParams, query: horariosQuery }), h(async (req, res) => {
    res.json(await u.horariosDisponiveis.executar({ slug: req.params.slug, ...(req.query as never as { profissionalId: string; servicoId: string; data: string }) }));
  }));

  r.post('/agendamentos', limitador(20), validar({ body: agendamentoSchema }), h(async (req, res) => {
    res.status(201).json(await u.criarAgendamento.executar(req.body));
  }));

  r.get('/agendamentos/:codigo', limitador(60), validar({ params: codigoParams }), h(async (req, res) => {
    res.json(await u.consultarAgendamento.executar(req.params.codigo));
  }));

  r.patch(
    '/agendamentos/:codigo/status',
    limitador(20),
    autenticacaoOpcional(c.tokens),
    validar({ params: codigoParams, body: statusSchema }),
    h(async (req, res) => {
      res.json(
        await u.atualizarStatusAgendamento.executar({
          codigo: req.params.codigo,
          status: req.body.status,
          estabelecimentoId: req.contratante?.estabelecimentoId,
        }),
      );
    }),
  );

  return r;
}
