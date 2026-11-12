import bcrypt from 'bcryptjs';
import request from 'supertest';
import {
  type Ambiente, bearer, corpoAgendamento, criarAmbiente, criarTenant, DIA, horarioFuturo, limparBanco, MINUTO,
} from './helpers';

let a: Ambiente;

beforeAll(() => {
  a = criarAmbiente();
});
beforeEach(async () => {
  await limparBanco(a.prisma);
  a.whatsapp.enviadas = [];
  a.whatsapp.falharSempre = false;
});
afterAll(async () => {
  await a.prisma.$disconnect();
});

const agendar = (corpo: object) => request(a.app).post('/api/v1/agendamentos').send(corpo);

describe('Cenário 1: sucesso na criação de agendamento', () => {
  it('201 com codigo e status CONFIRMADO', async () => {
    const t = await criarTenant(a);
    const res = await agendar(corpoAgendamento(t, horarioFuturo()));
    expect(res.status).toBe(201);
    expect(res.body.codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(res.body.status).toBe('CONFIRMADO');
  });
});

describe('Cenário 2: horário já ocupado', () => {
  it('409 HORARIO_INDISPONIVEL', async () => {
    const t = await criarTenant(a);
    const h = horarioFuturo();
    await agendar(corpoAgendamento(t, h)).expect(201);
    const res = await agendar(corpoAgendamento(t, h));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'HORARIO_INDISPONIVEL', message: 'Horário não está mais disponível' });
  });

  it('sobreposição parcial também conflita (duração do serviço)', async () => {
    const t = await criarTenant(a);
    await request(a.app).patch(`/api/v1/servicos/${t.servicoId}`).set(bearer(t)).send({ duracaoMinutos: 60 }).expect(200);
    await agendar(corpoAgendamento(t, horarioFuturo(3, 14, 0))).expect(201);
    await agendar(corpoAgendamento(t, horarioFuturo(3, 14, 30))).expect(409);
    await agendar(corpoAgendamento(t, horarioFuturo(3, 15, 0))).expect(201);
  });
});

describe('Cenário 3: transição inválida de status', () => {
  it('400 INVALID_STATUS_TRANSITION ao reativar cancelado (e ao cancelar de novo, CB-03)', async () => {
    const t = await criarTenant(a);
    const { body } = await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CANCELADO' }).expect(200);

    const res = await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CONFIRMADO' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'INVALID_STATUS_TRANSITION',
      message: 'Agendamentos cancelados não podem ser reativados.',
    });

    const de_novo = await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CANCELADO' });
    expect(de_novo.status).toBe(400);
    expect(de_novo.body.error).toBe('INVALID_STATUS_TRANSITION');
  });

  it('cancelar libera o horário', async () => {
    const t = await criarTenant(a);
    const h = horarioFuturo();
    const { body } = await agendar(corpoAgendamento(t, h)).expect(201);
    await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CANCELADO' }).expect(200);
    await agendar(corpoAgendamento(t, h)).expect(201);
  });
});

describe('Cenário 4: plano BASICO não dispara WhatsApp', () => {
  it('nenhuma notificação criada', async () => {
    const t = await criarTenant(a, { plano: 'BASICO' });
    await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    expect(await a.prisma.notificacaoWhatsapp.count()).toBe(0);
  });
});

describe('Cenário 5: PROFISSIONAL agenda confirmação e lembrete', () => {
  it('2 notificações PENDENTE (agora e 24h antes)', async () => {
    const t = await criarTenant(a, { plano: 'PROFISSIONAL' });
    const h = horarioFuturo(3);
    await agendar(corpoAgendamento(t, h)).expect(201);

    const ns = await a.prisma.notificacaoWhatsapp.findMany({ orderBy: { agendadaPara: 'asc' } });
    expect(ns).toHaveLength(2);
    expect(ns.every((n) => n.status === 'PENDENTE')).toBe(true);
    expect(ns.map((n) => n.tipo)).toEqual(['CONFIRMACAO', 'LEMBRETE']);
    expect(ns[1].agendadaPara.getTime()).toBe(new Date(h).getTime() - 24 * 60 * MINUTO);
  });

  it('envia a confirmação com data, serviço, profissional, código e link de cancelamento', async () => {
    const t = await criarTenant(a);
    const { body } = await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    await a.container.useCases.enviarNotificacoes.executar();
    expect(a.whatsapp.enviadas).toHaveLength(1);
    const msg = a.whatsapp.enviadas[0].texto;
    expect(msg).toContain('Corte masculino');
    expect(msg).toContain('Rafael');
    expect(msg).toContain(body.codigo);
    expect(msg).toContain(`http://localhost:3000/cancelar/${body.codigo}`);
  });

  it('cancelar descarta o lembrete e cria CANCELAMENTO', async () => {
    const t = await criarTenant(a);
    const { body } = await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CANCELADO' }).expect(200);
    const tipos = (await a.prisma.notificacaoWhatsapp.findMany()).map((n) => n.tipo);
    expect(tipos).toEqual(['CANCELAMENTO']);
  });
});

describe('Cenário 6: falha de WhatsApp não afeta o agendamento', () => {
  it('3 tentativas ➔ FALHA; agendamento segue CONFIRMADO; /agenda sinaliza', async () => {
    const t = await criarTenant(a);
    a.whatsapp.falharSempre = true;
    const { body } = await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);

    for (let i = 0; i < 3; i++) {
      await a.container.useCases.enviarNotificacoes.executar();
      a.relogio.avancar(6 * MINUTO); // passa o intervalo de reenvio
    }

    const n = await a.prisma.notificacaoWhatsapp.findFirstOrThrow({ where: { tipo: 'CONFIRMACAO' } });
    expect(n.status).toBe('FALHA');
    expect(n.tentativas).toBe(3);

    const ag = await a.prisma.agendamento.findUniqueOrThrow({ where: { codigo: body.codigo } });
    expect(ag.status).toBe('CONFIRMADO');

    const dia = horarioFuturo().slice(0, 10);
    const agenda = await request(a.app)
      .get(`/api/v1/agenda?inicio=${dia}&fim=${dia}`)
      .set(bearer(t))
      .expect(200);
    expect(agenda.body.itens[0].whatsapp).toMatchObject({ status: 'FALHA', ultimoErro: 'Número inválido' });
  });
});

describe('Cenário 7: catálogo bloqueado fora do PREMIUM', () => {
  it('403 RECURSO_INDISPONIVEL_NO_PLANO', async () => {
    const t = await criarTenant(a, { plano: 'PROFISSIONAL' });
    const res = await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ catalogoPublico: true });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('RECURSO_INDISPONIVEL_NO_PLANO');
  });
});

describe('Personalização (nome da agenda e logo)', () => {
  const LOGO = 'https://exemplo.com/logo.png';

  it('PROFISSIONAL salva título e logo; a página pública expõe os dois', async () => {
    const t = await criarTenant(a, { plano: 'PROFISSIONAL' });
    const r = await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ tituloAgenda: 'Agenda do Souza', logoUrl: LOGO });
    expect(r.status).toBe(200);
    const pub = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`).expect(200);
    expect(pub.body).toMatchObject({ tituloAgenda: 'Agenda do Souza', logoUrl: LOGO });
  });

  it('BASICO: título pode, logo ➔ 403 RECURSO_INDISPONIVEL_NO_PLANO', async () => {
    const t = await criarTenant(a, { plano: 'BASICO' });
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ tituloAgenda: 'Minha agenda' }).expect(200);
    const r = await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ logoUrl: LOGO });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('RECURSO_INDISPONIVEL_NO_PLANO');
  });

  it('rejeita logo que não seja http(s) e permite remover', async () => {
    const t = await criarTenant(a, { plano: 'PREMIUM' });
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ logoUrl: 'javascript:alert(1)' }).expect(422);
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ logoUrl: LOGO }).expect(200);
    const r = await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ logoUrl: null }).expect(200);
    expect(r.body.logoUrl).toBeNull();
  });

  it('downgrade para BASICO remove a logo quando passa a valer', async () => {
    const t = await criarTenant(a, { plano: 'PROFISSIONAL' });
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ logoUrl: LOGO }).expect(200);
    await request(a.app).post('/api/v1/assinatura/mudar-plano').set(bearer(t)).send({ plano: 'BASICO' }).expect(200);
    const hoje = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    await a.prisma.assinatura.update({ where: { estabelecimentoId: t.estabelecimentoId }, data: { proximaCobranca: hoje } });
    await a.container.useCases.processarCobrancas.executar();
    const me = await request(a.app).get('/api/v1/estabelecimentos/me').set(bearer(t)).expect(200);
    expect(me.body).toMatchObject({ plano: 'BASICO', logoUrl: null });
  });
});

describe('Cenário 8: página pública esconde preços sem catálogo', () => {
  it('BASICO: serviços sem preco e sem fotoUrl', async () => {
    const t = await criarTenant(a, { plano: 'BASICO' });
    const res = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`).expect(200);
    expect(res.body.servicos).toHaveLength(1);
    expect(res.body.servicos[0]).not.toHaveProperty('preco');
    expect(res.body.servicos[0]).not.toHaveProperty('fotoUrl');
    expect(res.body.servicos[0]).toMatchObject({ nome: 'Corte masculino', duracaoMinutos: 30 });
  });

  it('PREMIUM com catálogo ligado: expõe preco e fotoUrl', async () => {
    const t = await criarTenant(a, { plano: 'PREMIUM' });
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ catalogoPublico: true }).expect(200);
    const res = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`).expect(200);
    expect(res.body.servicos[0]).toMatchObject({ preco: 40, fotoUrl: 'https://exemplo.com/foto.jpg' });
  });
});

describe('Cenário 9: assinatura suspensa bloqueia novos agendamentos', () => {
  it('403 ASSINATURA_INATIVA, e a agenda continua acessível', async () => {
    const t = await criarTenant(a);
    const h = horarioFuturo();
    await agendar(corpoAgendamento(t, h)).expect(201);

    await a.prisma.assinatura.update({ where: { estabelecimentoId: t.estabelecimentoId }, data: { status: 'SUSPENSA' } });
    await a.prisma.estabelecimento.update({ where: { id: t.estabelecimentoId }, data: { status: 'SUSPENSO' } });

    const res = await agendar(corpoAgendamento(t, horarioFuturo(4)));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ASSINATURA_INATIVA');

    // Página pública não revela motivo de cobrança.
    const pub = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`);
    expect(pub.status).toBe(403);
    expect(pub.body.message).toBe('Agendamento temporariamente indisponível');

    const dia = h.slice(0, 10);
    const agenda = await request(a.app).get(`/api/v1/agenda?inicio=${dia}&fim=${dia}`).set(bearer(t));
    expect(agenda.status).toBe(200);
    expect(agenda.body.itens).toHaveLength(1);

    // Painel somente leitura.
    await request(a.app).post('/api/v1/servicos').set(bearer(t)).send({ nome: 'Barba', preco: 25, duracaoMinutos: 20 }).expect(403);
  });
});

describe('Cenário 10: inadimplência progressiva', () => {
  it('ATIVA ➔ EM_ATRASO ➔ SUSPENSA; pagamento reativa', async () => {
    const t = await criarTenant(a);
    const hoje = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    await a.prisma.assinatura.update({ where: { estabelecimentoId: t.estabelecimentoId }, data: { proximaCobranca: hoje } });

    const { processarCobrancas } = a.container.useCases;
    expect((await processarCobrancas.executar()).geradas).toBe(1);
    const cobranca = await a.prisma.cobranca.findFirstOrThrow();
    expect(cobranca.status).toBe('PENDENTE');

    a.relogio.avancar(DIA); // dia seguinte ao vencimento
    await processarCobrancas.executar();
    expect((await a.prisma.assinatura.findFirstOrThrow()).status).toBe('EM_ATRASO');
    // EM_ATRASO ainda aceita agendamentos (dentro da tolerância)
    await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);

    a.relogio.avancar(5 * DIA); // passou TOLERANCIA_DIAS_ATRASO
    await processarCobrancas.executar();
    expect((await a.prisma.assinatura.findFirstOrThrow()).status).toBe('SUSPENSA');
    expect((await a.prisma.estabelecimento.findFirstOrThrow()).status).toBe('SUSPENSO');

    await request(a.app)
      .post('/api/v1/webhooks/pagamentos')
      .set('x-webhook-secret', 'segredo-webhook-teste')
      .send({ referenciaExterna: cobranca.referenciaExterna })
      .expect(200);
    expect((await a.prisma.assinatura.findFirstOrThrow()).status).toBe('ATIVA');
    expect((await a.prisma.estabelecimento.findFirstOrThrow()).status).toBe('ATIVO');
  });

  it('webhook sem segredo é rejeitado', async () => {
    await request(a.app).post('/api/v1/webhooks/pagamentos').send({ referenciaExterna: 'x' }).expect(401);
  });
});

describe('Cenário 11: isolamento entre Contratantes', () => {
  it('A não enxerga profissional/serviço/agendamento de B (404)', async () => {
    const A = await criarTenant(a);
    const B = await criarTenant(a);
    await request(a.app).get(`/api/v1/profissionais/${B.profissionalId}`).set(bearer(A)).expect(404);
    await request(a.app).get(`/api/v1/servicos/${B.servicoId}`).set(bearer(A)).expect(404);
    await request(a.app).patch(`/api/v1/profissionais/${B.profissionalId}`).set(bearer(A)).send({ nome: 'Invasor' }).expect(404);
    await request(a.app).delete(`/api/v1/servicos/${B.servicoId}`).set(bearer(A)).expect(404);

    const { body } = await agendar(corpoAgendamento(B, horarioFuturo())).expect(201);
    await request(a.app)
      .patch(`/api/v1/agendamentos/${body.codigo}/status`)
      .set(bearer(A))
      .send({ status: 'CANCELADO' })
      .expect(404);

    const listaA = await request(a.app).get('/api/v1/profissionais').set(bearer(A)).expect(200);
    expect(listaA.body.itens.map((p: { id: string }) => p.id)).not.toContain(B.profissionalId);
  });

  it('agendar com profissional de outro tenant ➔ 404 (CB-01)', async () => {
    const A = await criarTenant(a);
    const B = await criarTenant(a);
    const res = await agendar(corpoAgendamento(A, horarioFuturo(), { profissionalId: B.profissionalId }));
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Profissional não encontrado');
  });
});

describe('Cenário 12: cadastro duplicado', () => {
  it('409 ESTABELECIMENTO_JA_CADASTRADO (CNPJ/CPF, e-mail ou slug)', async () => {
    const t = await criarTenant(a);
    const dono = await a.prisma.estabelecimento.findUniqueOrThrow({ where: { id: t.estabelecimentoId } });
    const novo = (o: object) => ({
      nome: 'Outra', slug: 'outra-loja', cnpjCpf: '11.222.333/0001-81', email: 'outra@exemplo.com', senha: 'senha-forte-123', plano: 'BASICO', ...o,
    });

    const porDoc = await request(a.app).post('/api/v1/estabelecimentos').send(novo({ cnpjCpf: dono.cnpjCpf.replace(/\D/g, '') }));
    expect(porDoc.status).toBe(409);
    expect(porDoc.body.error).toBe('ESTABELECIMENTO_JA_CADASTRADO');
    await request(a.app).post('/api/v1/estabelecimentos').send(novo({ email: t.email })).expect(409);
    await request(a.app).post('/api/v1/estabelecimentos').send(novo({ slug: t.slug })).expect(409);
  });

  it('CNPJ inválido ➔ 422', async () => {
    const res = await request(a.app)
      .post('/api/v1/estabelecimentos')
      .send({ nome: 'X Loja', slug: 'x-loja', cnpjCpf: '11.222.333/0001-80', email: 'x@exemplo.com', senha: 'senha-forte-123', plano: 'BASICO' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('Cenário 13: corrida pelo mesmo horário', () => {
  it('exatamente um 201 e um 409', async () => {
    const t = await criarTenant(a);
    const h = horarioFuturo();
    const [r1, r2] = await Promise.all([agendar(corpoAgendamento(t, h)), agendar(corpoAgendamento(t, h))]);
    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    expect(await a.prisma.agendamento.count({ where: { status: 'CONFIRMADO' } })).toBe(1);
  });
});

describe('Cenário 14: downgrade agendado', () => {
  it('nada muda até o fim do ciclo; depois plano e catálogo são ajustados', async () => {
    const t = await criarTenant(a, { plano: 'PREMIUM' });
    await request(a.app).patch('/api/v1/estabelecimentos/me').set(bearer(t)).send({ catalogoPublico: true }).expect(200);

    const res = await request(a.app).post('/api/v1/assinatura/mudar-plano').set(bearer(t)).send({ plano: 'PROFISSIONAL' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ plano: 'PROFISSIONAL', tipo: 'DOWNGRADE', valorMensal: 79 });

    const antes = await request(a.app).get('/api/v1/estabelecimentos/me').set(bearer(t)).expect(200);
    expect(antes.body).toMatchObject({ plano: 'PREMIUM', catalogoPublico: true });

    const hoje = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    await a.prisma.assinatura.update({ where: { estabelecimentoId: t.estabelecimentoId }, data: { proximaCobranca: hoje } });
    expect((await a.container.useCases.processarCobrancas.executar()).downgradesAplicados).toBe(1);

    const depois = await request(a.app).get('/api/v1/estabelecimentos/me').set(bearer(t)).expect(200);
    expect(depois.body).toMatchObject({ plano: 'PROFISSIONAL', catalogoPublico: false });
    const ass = await request(a.app).get('/api/v1/assinatura').set(bearer(t)).expect(200);
    expect(ass.body).toMatchObject({ plano: 'PROFISSIONAL', valorMensal: 79, planoAgendado: null });
  });

  it('upgrade vale na hora; mesmo plano ➔ 409', async () => {
    const t = await criarTenant(a, { plano: 'BASICO' });
    const up = await request(a.app).post('/api/v1/assinatura/mudar-plano').set(bearer(t)).send({ plano: 'PREMIUM' }).expect(200);
    expect(up.body).toMatchObject({ tipo: 'UPGRADE', valorMensal: 129 });
    const me = await request(a.app).get('/api/v1/estabelecimentos/me').set(bearer(t)).expect(200);
    expect(me.body.plano).toBe('PREMIUM');
    const igual = await request(a.app).post('/api/v1/assinatura/mudar-plano').set(bearer(t)).send({ plano: 'PREMIUM' });
    expect(igual.status).toBe(409);
    expect(igual.body.error).toBe('MUDANCA_DE_PLANO_INVALIDA');
  });
});

describe('Casos de borda adicionais', () => {
  it('CB-01: profissional inexistente ➔ 404', async () => {
    const t = await criarTenant(a);
    const res = await agendar(
      corpoAgendamento(t, horarioFuturo(), { profissionalId: '00000000-0000-4000-8000-000000000000' }),
    );
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Profissional não encontrado');
  });

  it('CB-02: data no passado ➔ 422', async () => {
    const t = await criarTenant(a);
    const res = await agendar(corpoAgendamento(t, '2020-01-01T14:00:00Z'));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe('A data do agendamento não pode ser no passado.');
  });

  it('CB-11: login com e-mail ou senha errados ➔ mesma resposta 401', async () => {
    const t = await criarTenant(a);
    const senhaErrada = await request(a.app).post('/api/v1/auth/login').send({ email: t.email, senha: 'errada-123' });
    const emailErrado = await request(a.app).post('/api/v1/auth/login').send({ email: 'nao@existe.com', senha: 'errada-123' });
    expect(senhaErrada.status).toBe(401);
    expect(emailErrado.status).toBe(401);
    expect(senhaErrada.body).toEqual(emailErrado.body);
    expect(senhaErrada.body.error).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('CB-12: profissional que não realiza o serviço ➔ 422', async () => {
    const t = await criarTenant(a);
    const outro = await request(a.app)
      .post('/api/v1/servicos').set(bearer(t)).send({ nome: 'Barba', preco: 25, duracaoMinutos: 20 }).expect(201);
    const res = await agendar(corpoAgendamento(t, horarioFuturo(), { servicoId: outro.body.id }));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('PROFISSIONAL_NAO_REALIZA_SERVICO');
  });

  it('CB-13: excluir profissional/serviço com agendamento futuro ➔ 409', async () => {
    const t = await criarTenant(a);
    await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    const p = await request(a.app).delete(`/api/v1/profissionais/${t.profissionalId}`).set(bearer(t));
    expect(p.status).toBe(409);
    expect(p.body.error).toBe('POSSUI_AGENDAMENTOS_FUTUROS');
    await request(a.app).delete(`/api/v1/servicos/${t.servicoId}`).set(bearer(t)).expect(409);
  });

  it('com histórico (sem futuros), excluir apenas desativa (RN-16)', async () => {
    const t = await criarTenant(a);
    const { body } = await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    await request(a.app).patch(`/api/v1/agendamentos/${body.codigo}/status`).send({ status: 'CANCELADO' }).expect(200);
    const res = await request(a.app).delete(`/api/v1/profissionais/${t.profissionalId}`).set(bearer(t)).expect(200);
    expect(res.body.desativado).toBe(true);
    const pub = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`).expect(200);
    expect(pub.body.profissionais).toHaveLength(0);
  });

  it('listagem de horários remove o horário já ocupado', async () => {
    const t = await criarTenant(a);
    const h = horarioFuturo(3, 14);
    const dia = h.slice(0, 10);
    const q = `profissionalId=${t.profissionalId}&servicoId=${t.servicoId}&data=${dia}`;
    const antes = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}/horarios?${q}`).expect(200);
    expect(antes.body.horarios).toContain('14:00');
    await agendar(corpoAgendamento(t, h)).expect(201);
    const depois = await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}/horarios?${q}`).expect(200);
    expect(depois.body.horarios).not.toContain('14:00');
  });

  it('horário fora do funcionamento ➔ 409', async () => {
    const t = await criarTenant(a);
    await agendar(corpoAgendamento(t, horarioFuturo(3, 22))).expect(409);
  });

  it('CB-05: slug inexistente ➔ 404', async () => {
    await request(a.app).get('/api/v1/estabelecimentos/nao-existe-mesmo').expect(404);
  });

  it('rotas do painel exigem JWT', async () => {
    await request(a.app).get('/api/v1/agenda?inicio=2026-10-15&fim=2026-10-15').expect(401);
    await request(a.app).get('/api/v1/estabelecimentos/me').expect(401);
  });
});

describe('Backoffice da plataforma', () => {
  async function loginAdmin(papel: 'ADMIN' | 'SUPORTE' = 'ADMIN') {
    const senhaHash = await bcrypt.hash('admin-1234', 4);
    await a.prisma.usuarioPlataforma.create({
      data: { nome: 'Op', email: `${papel.toLowerCase()}@agendafacil.com`, senhaHash, papel },
    });
    const res = await request(a.app)
      .post('/api/v1/plataforma/auth/login')
      .send({ email: `${papel.toLowerCase()}@agendafacil.com`, senha: 'admin-1234' })
      .expect(200);
    return { Authorization: `Bearer ${res.body.token}` };
  }

  it('lista, suspende com auditoria e calcula métricas — sem dados de Cliente Final', async () => {
    const t = await criarTenant(a, { plano: 'PROFISSIONAL' });
    await criarTenant(a, { plano: 'PREMIUM' });
    await agendar(corpoAgendamento(t, horarioFuturo())).expect(201);
    const admin = await loginAdmin('ADMIN');

    const lista = await request(a.app).get('/api/v1/plataforma/estabelecimentos').set(admin).expect(200);
    expect(lista.body.itens).toHaveLength(2);

    const detalhe = await request(a.app).get(`/api/v1/plataforma/estabelecimentos/${t.estabelecimentoId}`).set(admin).expect(200);
    const json = JSON.stringify(detalhe.body);
    expect(json).not.toContain('Marina Costa');
    expect(json).not.toContain('+55829');

    await request(a.app)
      .patch(`/api/v1/plataforma/estabelecimentos/${t.estabelecimentoId}/status`)
      .set(admin)
      .send({ status: 'SUSPENSO' })
      .expect(200);
    expect(await a.prisma.auditoriaPlataforma.count({ where: { acao: 'SUSPENDER_ESTABELECIMENTO' } })).toBe(1);
    await request(a.app).get(`/api/v1/estabelecimentos/${t.slug}`).expect(403);

    const m = await request(a.app).get('/api/v1/plataforma/metricas').set(admin).expect(200);
    expect(m.body).toMatchObject({ contratantesAtivos: 1, mrr: 129, contratantesPorPlano: { PREMIUM: 1, PROFISSIONAL: 0, BASICO: 0 } });
  });

  it('SUPORTE não suspende nem vê métricas; token de Contratante não acessa /plataforma', async () => {
    const t = await criarTenant(a);
    const suporte = await loginAdmin('SUPORTE');
    await request(a.app).get('/api/v1/plataforma/metricas').set(suporte).expect(403);
    await request(a.app)
      .patch(`/api/v1/plataforma/estabelecimentos/${t.estabelecimentoId}/status`)
      .set(suporte).send({ status: 'SUSPENSO' }).expect(403);
    await request(a.app).get('/api/v1/plataforma/estabelecimentos').set(bearer(t)).expect(403);
  });
});
