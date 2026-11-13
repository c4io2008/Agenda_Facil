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
  servicoIds: string[];
  horariosAtendimento: {
    diaSemana: number;
    inicio: string;
    fim: string;
  }[];
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface JanelaFuncionamento { diaSemana: number; inicio: string; fim: string }

export default function Painel() {
  const [ass, setAss] = useState<Assinatura | null>(null);
  const [inicio, setInicio] = useState(hoje());
  const [fim, setFim] = useState(() =>
    new Date(Date.now() + 7 * 86_400_000).toLocaleDateString('sv-SE')
  );
  const [slug, setSlug] = useState('');
  const [titulo, setTitulo] = useState('Agenda');
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<JanelaFuncionamento[]>([]);
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
  const [servicosSelecionadosProf, setServicosSelecionadosProf] = useState<string[]>([]);
  const [servicosDropdownAberto, setServicosDropdownAberto] = useState(false);
  const [profissionalEmEdicao, setProfissionalEmEdicao] = useState<{
    id: string;
    nome: string;
    servicoIds: string[];
    horariosAtendimento: { diaSemana: number; inicio: string; fim: string }[];
  } | null>(null);

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
    api<{ slug: string; tituloAgenda: string | null; horariosFuncionamento: JanelaFuncionamento[] }>(
      '/estabelecimentos/me',
      { auth: 'contratante' }
    )
      .then((e) => {
        setSlug(e.slug);
        setTitulo(e.tituloAgenda || 'Agenda');
        setHorariosFuncionamento(e.horariosFuncionamento ?? []);
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
      setServicosSelecionadosProf([]);
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
    const servicoIds = servicosSelecionadosProf;
    const dias = f.getAll('dias').map(Number);

    if (servicoIds.length === 0) {
      setErro('Selecione pelo menos um serviço para o profissional.');
      return;
    }

    if (dias.length === 0) {
      setErro('Selecione pelo menos um dia de atendimento.');
      return;
    }

    try {
      await api('/profissionais', {
        method: 'POST',
        auth: 'contratante',
        body: {
          nome: f.get('nome'),
          servicoIds,
          horariosAtendimento: dias.map((d) => ({
            diaSemana: d,
            inicio: String(f.get(`inicio-${d}`) ?? ''),
            fim: String(f.get(`fim-${d}`) ?? ''),
          })),
        },
      });

      form.reset();
      setServicosSelecionadosProf([]);
      setServicosDropdownAberto(false);
      await carregar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  async function excluirServico(id: string, nome: string) {
    if (!confirm(`Deseja remover o serviço "${nome}"?`)) return;

    try {
      const resultado = await api<{ desativado: boolean }>(`/servicos/${id}`, {
        method: 'DELETE',
        auth: 'contratante',
      });

      setEditando(null);
      await carregar();

      setErro(
        resultado.desativado
          ? `O serviço "${nome}" foi desativado porque possui histórico de agendamentos.`
          : `O serviço "${nome}" foi removido.`
      );
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  function iniciarEdicaoProfissional(profissional: Prof) {
    setErro('');
    setProfissionalEmEdicao({
      id: profissional.id,
      nome: profissional.nome,
      servicoIds: [...profissional.servicoIds],
      horariosAtendimento: profissional.horariosAtendimento.map((h) => ({ ...h })),
    });
  }

  function atualizarHorarioEdicao(diaSemana: number, campo: 'inicio' | 'fim', valor: string) {
    setProfissionalEmEdicao((atual) => {
      if (!atual) return atual;
      return {
        ...atual,
        horariosAtendimento: atual.horariosAtendimento.map((h) =>
          h.diaSemana === diaSemana ? { ...h, [campo]: valor } : h
        ),
      };
    });
  }

  function alternarDiaEdicao(diaSemana: number, marcado: boolean) {
    setProfissionalEmEdicao((atual) => {
      if (!atual) return atual;
      if (marcado) {
        const funcionamento = horariosFuncionamento.find((h) => h.diaSemana === diaSemana);
        if (!funcionamento) return atual;
        return {
          ...atual,
          horariosAtendimento: [...atual.horariosAtendimento, {
            diaSemana,
            inicio: funcionamento.inicio,
            fim: funcionamento.fim,
          }].sort((a, b) => a.diaSemana - b.diaSemana),
        };
      }
      return {
        ...atual,
        horariosAtendimento: atual.horariosAtendimento.filter((h) => h.diaSemana !== diaSemana),
      };
    });
  }

  async function salvarEdicaoProfissional() {
    if (!profissionalEmEdicao) return;
    if (!profissionalEmEdicao.nome.trim()) {
      setErro('Informe o nome do profissional.');
      return;
    }
    if (profissionalEmEdicao.servicoIds.length === 0) {
      setErro('Selecione pelo menos um serviço para o profissional.');
      return;
    }
    if (profissionalEmEdicao.horariosAtendimento.length === 0) {
      setErro('Selecione pelo menos um dia de atendimento.');
      return;
    }
    if (profissionalEmEdicao.horariosAtendimento.some((h) => h.fim <= h.inicio)) {
      setErro('Em cada dia, o horário final deve ser depois do horário inicial.');
      return;
    }

    try {
      await api(`/profissionais/${profissionalEmEdicao.id}`, {
        method: 'PATCH',
        auth: 'contratante',
        body: {
          nome: profissionalEmEdicao.nome.trim(),
          servicoIds: profissionalEmEdicao.servicoIds,
          horariosAtendimento: profissionalEmEdicao.horariosAtendimento,
        },
      });
      setProfissionalEmEdicao(null);
      await carregar();
      setErro('Profissional atualizado com sucesso.');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  async function excluirProfissional(id: string, nome: string) {
    if (!confirm(`Deseja remover o profissional "${nome}"?`)) return;

    try {
      const resultado = await api<{ desativado: boolean }>(`/profissionais/${id}`, {
        method: 'DELETE',
        auth: 'contratante',
      });

      await carregar();

      setErro(
        resultado.desativado
          ? `O profissional "${nome}" foi desativado porque possui histórico de agendamentos.`
          : `O profissional "${nome}" foi removido.`
      );
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

              <fieldset className="servicos-profissional-fieldset">
                <legend>Serviços que realiza (obrigatório)</legend>
                <div className="servicos-profissional-select">
                  <button
                    className="servicos-profissional-gatilho"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={servicosDropdownAberto}
                    onClick={() => setServicosDropdownAberto((aberto) => !aberto)}
                  >
                    <span className={servicosSelecionadosProf.length === 0 ? 'placeholder' : ''}>
                      {servicosSelecionadosProf.length === 0
                        ? 'Selecione os serviços'
                        : servicos
                            .filter((s) => servicosSelecionadosProf.includes(s.id))
                            .map((s) => s.nome)
                            .join(', ')}
                    </span>
                    <span className="servicos-profissional-seta" aria-hidden="true">⋮</span>
                  </button>
                  {servicosDropdownAberto && (
                    <div className="servicos-profissional-opcoes" role="group" aria-label="Serviços disponíveis">
                      {servicos.filter((s) => s.ativo).length === 0 ? (
                        <p>Nenhum serviço cadastrado.</p>
                      ) : servicos.filter((s) => s.ativo).map((s) => (
                        <label key={s.id}>
                          <input
                            type="checkbox"
                            checked={servicosSelecionadosProf.includes(s.id)}
                            onChange={(e) => setServicosSelecionadosProf((atuais) =>
                              e.target.checked
                                ? [...atuais, s.id]
                                : atuais.filter((id) => id !== s.id)
                            )}
                          />
                          <span>{s.nome}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {servicosSelecionadosProf.length > 0 && (
                  <small className="servicos-profissional-contagem">
                    {servicosSelecionadosProf.length} serviço(s) selecionado(s)
                  </small>
                )}
              </fieldset>

              <fieldset className="horarios-profissional">
                <legend>Dias e horários de atendimento (obrigatório)</legend>
                {horariosFuncionamento.length === 0 && (
                  <p className="aviso-horarios">
                    Primeiro configure os horários da empresa em <a href="/painel/configuracoes">Configurações</a>.
                  </p>
                )}

                {DIAS.map((d, n) => {
                  const funcionamento = horariosFuncionamento.find((h) => h.diaSemana === n);
                  return (
                    <div key={d} className="dia-horario-profissional">
                      <label>
                        <input
                          type="checkbox"
                          name="dias"
                          value={n}
                          disabled={!funcionamento}
                          style={{ width: 'auto' }}
                        />{' '}
                        <strong>{d}</strong>
                        {!funcionamento && <small>Empresa fechada</small>}
                      </label>
                      {funcionamento && (
                        <div className="campos-horario-profissional">
                          <label>
                            <span>Início</span>
                            <input
                              type="time"
                              name={`inicio-${n}`}
                              min={funcionamento.inicio}
                              max={funcionamento.fim}
                              defaultValue={funcionamento.inicio}
                              required
                            />
                          </label>
                          <label>
                            <span>Fim</span>
                            <input
                              type="time"
                              name={`fim-${n}`}
                              min={funcionamento.inicio}
                              max={funcionamento.fim}
                              defaultValue={funcionamento.fim}
                              required
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>

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

                    <div className="acoes-catalogo">
                      <button
                        type="button"
                        className="sec"
                        onClick={() => setEditando(s.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="sec btn-remover"
                        onClick={() => excluirServico(s.id, s.nome)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MEUS PROFISSIONAIS */}
        {!somenteLeitura && profs.some((p) => p.ativo) && (
          <div className="servicos-section">
            <h2>Meus profissionais</h2>

            {profs.filter((p) => p.ativo).map((p) => {
              const nomesServicos = p.servicoIds
                .map((id) => servicos.find((s) => s.id === id)?.nome)
                .filter((nome): nome is string => Boolean(nome));

              const dias = [...new Set(
                p.horariosAtendimento.map((h) => h.diaSemana)
              )]
                .sort((a, b) => a - b)
                .map((dia) => DIAS[dia]);

              return (
                <div key={p.id} className="card servico-card">
                  <div className="linha">
                    <div>
                      <strong>{p.nome}</strong>
                      <br />
                      <small>
                        Serviços: {nomesServicos.join(', ') || 'Nenhum serviço'}
                      </small>
                      <br />
                      <small>
                        Dias: {dias.join(', ') || 'Nenhum dia configurado'}
                      </small>
                    </div>

                    <div className="acoes-catalogo">
                      <button
                        type="button"
                        className="sec"
                        onClick={() => iniciarEdicaoProfissional(p)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="sec btn-remover"
                        onClick={() => excluirProfissional(p.id, p.nome)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  {profissionalEmEdicao?.id === p.id && (
                    <div className="editar-profissional-form">
                      <h3>Editar profissional</h3>
                      <label htmlFor={`prof-nome-${p.id}`}>Nome</label>
                      <input
                        id={`prof-nome-${p.id}`}
                        value={profissionalEmEdicao.nome}
                        onChange={(e) => setProfissionalEmEdicao((atual) => atual ? { ...atual, nome: e.target.value } : atual)}
                        required
                      />

                      <fieldset className="servicos-profissional-fieldset">
                        <legend>Serviços que realiza (obrigatório)</legend>
                        <div className="servicos-edicao-lista">
                          {servicos.filter((s) => s.ativo).map((servico) => (
                            <label key={servico.id}>
                              <input
                                type="checkbox"
                                checked={profissionalEmEdicao.servicoIds.includes(servico.id)}
                                onChange={(e) => setProfissionalEmEdicao((atual) => {
                                  if (!atual) return atual;
                                  return { ...atual, servicoIds: e.target.checked
                                    ? [...atual.servicoIds, servico.id]
                                    : atual.servicoIds.filter((id) => id !== servico.id) };
                                })}
                              />
                              <span>{servico.nome}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset className="horarios-profissional">
                        <legend>Dias e horários de atendimento (obrigatório)</legend>
                        {DIAS.map((dia, diaSemana) => {
                          const funcionamento = horariosFuncionamento.find((h) => h.diaSemana === diaSemana);
                          const horario = profissionalEmEdicao.horariosAtendimento.find((h) => h.diaSemana === diaSemana);
                          return (
                            <div key={dia} className="dia-horario-profissional">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={Boolean(horario)}
                                  disabled={!funcionamento}
                                  onChange={(e) => alternarDiaEdicao(diaSemana, e.target.checked)}
                                  style={{ width: 'auto' }}
                                />{' '}
                                <strong>{dia}</strong>
                                {!funcionamento && <small>Empresa fechada</small>}
                              </label>
                              {horario && (
                                <div className="campos-horario-profissional">
                                  <label>
                                    <span>Início</span>
                                    <input
                                      type="time"
                                      value={horario.inicio}
                                      min={funcionamento?.inicio}
                                      max={funcionamento?.fim}
                                      onChange={(e) => atualizarHorarioEdicao(diaSemana, 'inicio', e.target.value)}
                                    />
                                  </label>
                                  <label>
                                    <span>Fim</span>
                                    <input
                                      type="time"
                                      value={horario.fim}
                                      min={funcionamento?.inicio}
                                      max={funcionamento?.fim}
                                      onChange={(e) => atualizarHorarioEdicao(diaSemana, 'fim', e.target.value)}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </fieldset>
                      <div className="profissional-acoes">
                        <button type="button" onClick={salvarEdicaoProfissional}>Salvar alterações</button>
                        <button type="button" className="sec" onClick={() => setProfissionalEmEdicao(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </PainelShell>
  );
}
