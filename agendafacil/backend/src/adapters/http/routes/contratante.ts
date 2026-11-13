import { Router } from 'express';
import type { Container } from '../../../infrastructure/container';
import {
  agendaQuery, estabelecimentoPatchSchema, horariosFuncionamentoSchema, idParams, metricasQuery, mudarPlanoSchema,
  profissionalPatchSchema, profissionalSchema, servicoPatchSchema, servicoSchema,
} from '../schemas';
import { autenticarContratante, h, validar } from '../middlewares';

/** Todas as rotas daqui exigem JWT; o tenant vem de `req.contratante`, nunca do body. */
export function rotasContratante(c: Container): Router {
  const r = Router();
  const u = c.useCases;
  const auth = autenticarContratante(c.tokens);
  const est = (req: Express.Request) => req.contratante!.estabelecimentoId;

  r.get('/estabelecimentos/me', auth, h(async (req, res) => {
    res.json(await u.obterEstabelecimento.executar(est(req)));
  }));
  r.patch('/estabelecimentos/me', auth, validar({ body: estabelecimentoPatchSchema }), h(async (req, res) => {
    res.json(await u.atualizarEstabelecimento.executar(est(req), req.body));
  }));
  r.put('/estabelecimentos/me/horarios-funcionamento', auth, validar({ body: horariosFuncionamentoSchema }), h(async (req, res) => {
    res.json(await u.substituirHorarios.executar(est(req), req.body.horariosFuncionamento));
  }));

  // Serviços
  r.get('/servicos', auth, h(async (req, res) => {
    res.json({ itens: await u.servicos.listar(est(req)) });
  }));
  r.post('/servicos', auth, validar({ body: servicoSchema }), h(async (req, res) => {
    res.status(201).json(await u.servicos.criar(est(req), { ...req.body, fotoUrl: req.body.fotoUrl ?? null, descricao: req.body.descricao || null }));
  }));
  r.get('/servicos/:id', auth, validar({ params: idParams }), h(async (req, res) => {
    res.json(await u.servicos.obter(est(req), req.params.id));
  }));
  r.patch('/servicos/:id', auth, validar({ params: idParams, body: servicoPatchSchema }), h(async (req, res) => {
    res.json(await u.servicos.atualizar(est(req), req.params.id, req.body));
  }));
  r.delete('/servicos/:id', auth, validar({ params: idParams }), h(async (req, res) => {
    res.json(await u.servicos.excluir(est(req), req.params.id));
  }));

  // Profissionais
  r.get('/profissionais', auth, h(async (req, res) => {
    res.json({ itens: await u.profissionais.listar(est(req)) });
  }));
  r.post('/profissionais', auth, validar({ body: profissionalSchema }), h(async (req, res) => {
    res.status(201).json(await u.profissionais.criar(est(req), req.body));
  }));
  r.get('/profissionais/:id', auth, validar({ params: idParams }), h(async (req, res) => {
    res.json(await u.profissionais.obter(est(req), req.params.id));
  }));
  r.patch('/profissionais/:id', auth, validar({ params: idParams, body: profissionalPatchSchema }), h(async (req, res) => {
    res.json(await u.profissionais.atualizar(est(req), req.params.id, req.body));
  }));
  r.delete('/profissionais/:id', auth, validar({ params: idParams }), h(async (req, res) => {
    res.json(await u.profissionais.excluir(est(req), req.params.id));
  }));

  // Agenda
  r.get('/agenda', auth, validar({ query: agendaQuery }), h(async (req, res) => {
    res.json(await u.agenda.agenda(est(req), req.query as never));
  }));
  r.get('/agenda/metricas', auth, validar({ query: metricasQuery }), h(async (req, res) => {
    res.json(await u.agenda.metricas(est(req), (req.query as { data?: string }).data));
  }));

  // Assinatura
  r.get('/assinatura', auth, h(async (req, res) => {
    res.json(await u.assinatura.executar(est(req)));
  }));
  r.post('/assinatura/mudar-plano', auth, validar({ body: mudarPlanoSchema }), h(async (req, res) => {
    res.json(await u.mudarPlano.executar(est(req), req.body.plano));
  }));
  r.post('/assinatura/cancelar', auth, h(async (req, res) => {
    res.json(await u.cancelarAssinatura.executar(est(req)));
  }));
  r.get('/cobrancas', auth, h(async (req, res) => {
    res.json(await u.cobrancas.executar(est(req)));
  }));

  return r;
}
