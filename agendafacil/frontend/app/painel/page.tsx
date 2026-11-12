'use client';

import './page.css';
import { useCallback, useEffect, useState } from 'react';
import PainelShell, { type Assinatura } from '@/components/PainelShell';
import { api, brl, hoje, mensagemDeErro } from '@/lib/api';

interface Item {
  codigo: string;
  nomeCliente: string;
  servico: string;
  profissional: string;
  dataHora: string;
  status: string;
  whatsapp: {
    status: string;
    ultimoErro: string | null;
  } | null;
}

interface Servico {
  id: string;
  nome: string;
  ativo: boolean;
  preco: number;
  duracaoMinutos: number;
  fotoUrl: string | null;
}

interface Prof {
  id: string;
  nome: string;
  ativo: boolean;
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Painel() {
  const [ass, setAss] = useState<Assinatura | null>(null);
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(() =>
    new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('sv-SE')
  );
  const [slug, setSlug] = useState('');
  const [titulo, setTitulo] = useState('Agenda');
  const [copiado, setCopiado] = useState(false);
  const [profFiltro, setProfFiltro] = useState('');
  const [itens, setItens] = useState<Item[]>([]);
  const [metricas, setMetricas] = useState({
    total: 0,
    confirmados: 0,
    cancelados: 0,
  });
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<string | null>(null);

  const somenteLeitura = ass
    ? ass.status === 'SUSPENSA' || ass.status === 'CANCELADA'
    : false;

  const carregar = useCallback(async () => {
    try {
      const q = `inicio=${inicio}&fim=${fim}${profFiltro ? `&profissionalId=${profFiltro}` : ''}`;

      const [ag, m, s, p] = await Promise.all([
        api<{ itens: Item[] }>(`/agenda?${q}`, { auth: 'contratante' }),
        api<typeof metricas>(`/agenda/metricas?data=${hoje()}`, { auth: 'contratante' }),
        api<{ itens: Servico[] }>('/servicos', { auth: 'contratante' }),
        api<{ itens: Prof[] }>('/profissionais', { auth: 'contratante' }),
      ]);

      setItens(ag.itens);
      setMetricas(m);
      setServicos(s.itens);
      setProfs(p.itens);
      setErro('');
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }, [inicio, fim, profFiltro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    api<{ slug: string; tituloAgenda: string | null }>(
      '/estabelecimentos/me',
      { auth: 'contratante' }
    )
      .then((e) => {
        setSlug(e.slug);
        setTitulo(e.tituloAgenda || 'Agenda');
      })
      .catch(() => { });
  }, []);

  const link =
    slug && typeof window !== 'undefined'
      ? `${window.location.origin}/agendar/${slug}`
      : '';

  async function cancelar(codigo: string) {
    if (!confirm('Cancelar este agendamento? O horário será liberado.')) return;

    try {
      await api(`/agendamentos/${codigo}/status`, {
        method: 'PATCH',
        body: { status: 'CANCELADO' },
        auth: 'contratante',
      });

      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  async function novoServico(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;

    try {
      await api('/servicos', {
        method: 'POST',
        auth: 'contratante',
        body: {
          nome: f.get('nome'),
          preco: Number(f.get('preco')),
          duracaoMinutos: Number(f.get('duracao')),
          fotoUrl: f.get('foto') || null,
        },
      });

      form.reset();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  async function salvarServico(
    e: React.FormEvent<HTMLFormElement>,
    id: string
  ) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    try {
      await api(`/servicos/${id}`, {
        method: 'PATCH',
        auth: 'contratante',
        body: {
          nome: f.get('nome'),
          preco: Number(f.get('preco')),
          duracaoMinutos: Number(f.get('duracao')),
          ...(ass?.recursos.catalogoPublico
            ? { fotoUrl: (f.get('foto') as string) || null }
            : {}),
        },
      });

      setEditando(null);
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  async function novoProfissional(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const dias = f.getAll('dias').map(Number);

    try {
      await api('/profissionais', {
        method: 'POST',
        auth: 'contratante',
        body: {
          nome: f.get('nome'),
          servicoIds: f.getAll('servicos'),
          horariosAtendimento: dias.map((d) => ({
            diaSemana: d,
            inicio: f.get('inicio'),
            fim: f.get('fim'),
          })),
        },
      });

      form.reset();
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <PainelShell onAssinatura={setAss}>
      <div className="painel-agenda">

        <h1 className="agenda-titulo">{titulo}</h1>

        {/* LINK DE AGENDAMENTO */}
        {link && (
          <div className="card link-card">
            <div className="link-info">
              Link de agendamento dos seus clientes:
              <br />
              <strong>{link}</strong>
            </div>

            <div className="link-acoes">
              <a className="btn" href={link} target="_blank" rel="noreferrer">
                Abrir página do cliente
              </a>

              <button
                type="button"
                className="sec"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  setCopiado(true);
                }}
              >
                {copiado ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        )}

        <div className="metricas" aria-label="Métricas de hoje">
          <div className="card metrica-card">
            <strong>{metricas.total}</strong>
            <span>agendamentos hoje</span>
          </div>

          <div className="card metrica-card">
            <strong>{metricas.confirmados}</strong>
            <span>confirmados</span>
          </div>

          <div className="card metrica-card">
            <strong>{metricas.cancelados}</strong>
            <span>cancelados</span>
          </div>
        </div>

        {/* FILTROS */}
        <div className="card filtros-grid">
          <div>
            <label htmlFor="ini">De</label>
            <input
              id="ini"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="fim">Até</label>
            <input
              id="fim"
              type="date"
              value={fim}
              min={inicio}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="pf">Profissional</label>
            <select
              id="pf"
              value={profFiltro}
              onChange={(e) => setProfFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              {profs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ERROS */}
        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}

        {/* AGENDAMENTOS */}
        {itens.length === 0 && (
          <p>
            Nenhum agendamento neste período (padrão: hoje + 7 dias).
            Ajuste as datas acima ou compartilhe seu link com os clientes.
          </p>
        )}

        {itens.map((i) => (
          <article key={i.codigo} className="card agendamento-card">
            <div>
              <strong>
                {new Date(i.dataHora).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </strong>
              {' · '}
              {i.nomeCliente}
              <br />

              {i.servico} com {i.profissional}{' '}

              <span className="tag">
                {i.status === 'CONFIRMADO' ? 'Confirmado' : 'Cancelado'}
              </span>

              {' '}

              {i.whatsapp?.status === 'FALHA' && (
                <span
                  className="tag falha"
                  title={i.whatsapp.ultimoErro ?? ''}
                >
                  WhatsApp não enviado
                </span>
              )}
            </div>

            {i.status === 'CONFIRMADO' && !somenteLeitura && (
              <button
                type="button"
                className="sec"
                onClick={() => cancelar(i.codigo)}
              >
                Cancelar
              </button>
            )}
          </article>
        ))}

        {/* FORMULÁRIOS */}
        {!somenteLeitura && (
          <div className="formularios-grid">

            {/* NOVO SERVIÇO */}
            <form
              className="card formulario-card"
              onSubmit={novoServico}
            >
              <h2>Novo serviço</h2>

              <label htmlFor="sn">Nome</label>
              <input id="sn" name="nome" required minLength={2} />

              <label htmlFor="sp">Preço (R$)</label>
              <input
                id="sp"
                name="preco"
                type="number"
                step="0.01"
                min="0"
                required
              />

              <label htmlFor="sd">Duração (min)</label>
              <input
                id="sd"
                name="duracao"
                type="number"
                min="5"
                step="5"
                required
              />

              {ass?.recursos.catalogoPublico && (
                <>
                  <label htmlFor="sf">Foto (URL)</label>
                  <input id="sf" name="foto" type="url" />
                </>
              )}

              <p>
                <button type="submit">Salvar serviço</button>
              </p>

              <small>
                {servicos.length} serviço(s) cadastrado(s)
              </small>
            </form>

            {/* NOVO PROFISSIONAL */}
            <form
              className="card formulario-card"
              onSubmit={novoProfissional}
            >
              <h2>Novo profissional</h2>

              <label htmlFor="pn">Nome</label>
              <input id="pn" name="nome" required minLength={2} />

              <fieldset>
                <legend>Serviços que realiza</legend>

                {servicos.filter((s) => s.ativo).map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      name="servicos"
                      value={s.id}
                      style={{ width: 'auto' }}
                    />
                    {' '}{s.nome}
                  </label>
                ))}
              </fieldset>

              <fieldset>
                <legend>Dias de atendimento</legend>

                {DIAS.map((d, n) => (
                  <label
                    key={d}
                    style={{ display: 'inline-block', marginRight: 8 }}
                  >
                    <input
                      type="checkbox"
                      name="dias"
                      value={n}
                      style={{ width: 'auto' }}
                    />
                    {' '}{d}
                  </label>
                ))}
              </fieldset>

              <label htmlFor="pi">Início</label>
              <input
                id="pi"
                name="inicio"
                type="time"
                defaultValue="09:00"
                required
              />

              <label htmlFor="pfim">Fim</label>
              <input
                id="pfim"
                name="fim"
                type="time"
                defaultValue="18:00"
                required
              />

              <div className="profissional-acoes">
                <button type="submit">Salvar profissional</button>
              </div>
              
            </form>
          </div>
        )}

        {/* MEUS SERVIÇOS */}
        {!somenteLeitura && servicos.length > 0 && (
          <div className="servicos-section">
            <h2>Meus serviços</h2>

            {servicos.filter((s) => s.ativo).map((s) => (
              <div key={s.id} className="card servico-card">
                {editando === s.id ? (
                  <form onSubmit={(e) => salvarServico(e, s.id)}>
                    <label htmlFor={`en-${s.id}`}>Nome</label>
                    <input
                      id={`en-${s.id}`}
                      name="nome"
                      defaultValue={s.nome}
                      required
                      minLength={2}
                    />

                    <label htmlFor={`ep-${s.id}`}>Preço (R$)</label>
                    <input
                      id={`ep-${s.id}`}
                      name="preco"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={s.preco}
                      required
                    />

                    <label htmlFor={`ed-${s.id}`}>Duração (min)</label>
                    <input
                      id={`ed-${s.id}`}
                      name="duracao"
                      type="number"
                      min="5"
                      step="5"
                      defaultValue={s.duracaoMinutos}
                      required
                    />

                    {ass?.recursos.catalogoPublico && (
                      <>
                        <label htmlFor={`ef-${s.id}`}>Foto (URL)</label>
                        <input
                          id={`ef-${s.id}`}
                          name="foto"
                          type="url"
                          defaultValue={s.fotoUrl ?? ''}
                        />
                      </>
                    )}

                    <p>
                      <button type="submit">Salvar</button>
                      {' '}
                      <button
                        type="button"
                        className="sec"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                    </p>
                  </form>
                ) : (
                  <div className="linha">
                    <div>
                      <strong>{s.nome}</strong>
                      {' · '}
                      {s.duracaoMinutos} min
                      {' · '}
                      {brl(Number(s.preco))}
                      <br />

                      {s.fotoUrl ? (
                        <img
                          src={s.fotoUrl}
                          alt=""
                          style={{
                            maxWidth: 120,
                            borderRadius: 8,
                            marginTop: 6,
                          }}
                        />
                      ) : (
                        <small>Sem foto</small>
                      )}
                    </div>

                    <button
                      type="button"
                      className="sec"
                      onClick={() => setEditando(s.id)}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </PainelShell>
  );
}
