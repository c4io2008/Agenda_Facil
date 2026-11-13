'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Calendario from '@/components/Calendario';
import Carregando from '@/components/Carregando';
import NavPublica from '@/components/NavPublica';
import TelaCodigo from '@/components/TelaCodigo';
import { api, ApiError, brl, hoje, localParaUTC, mensagemDeErro } from '@/lib/api';
import { formatarWhatsapp, whatsappE164 } from '@/lib/formatar';
import { salvarCodigo } from '@/lib/meus-agendamentos';
import { aplicarTema, limparTema } from '@/lib/temas';
import '../agendar.css';

interface Servico {
  id: string;
  nome: string;
  duracaoMinutos: number;
  preco?: number;
  fotoUrl?: string | null;
  descricao?: string | null;
}

interface Pagina {
  id: string;
  nome: string;
  fusoHorario: string;
  catalogoPublico: boolean;
  whatsapp: boolean;
  mensagemCancelamento: string;
  horariosFuncionamento: { diaSemana: number; inicio: string; fim: string }[];
  logoUrl: string | null;
  tema: string;
  servicos: Servico[];
  profissionais: { id: string; nome: string; servicoIds: string[] }[];
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function Agendar() {
  const { slug } = useParams<{ slug: string }>();
  const [pag, setPag] = useState<Pagina | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);

  // Modal de agendamento
  const [servico, setServico] = useState<Servico | null>(null);
  const [profId, setProfId] = useState('');
  const [data, setData] = useState('');
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [hora, setHora] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Resultado
  const [codigo, setCodigo] = useState('');
  const [cancelado, setCancelado] = useState(false);
  const [erroCancelar, setErroCancelar] = useState('');

  const servicosRef = useRef<HTMLElement>(null);
  const [rolou, setRolou] = useState(false); // já saiu da 1ª tela? (a seta passa a subir)
  const primeiroCampo = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api<Pagina>(`/estabelecimentos/${slug}`).then(setPag).catch(() => setIndisponivel(true));
  }, [slug]);

  // Tema do Contratante (Lima, Oceano, Rosa neon, Âmbar, Claro).
  useEffect(() => {
    if (!pag) return;
    aplicarTema(pag.tema);
    return () => limparTema();
  }, [pag]);

  const profs = useMemo(
    () => (pag && servico ? pag.profissionais.filter((p) => p.servicoIds.includes(servico.id)) : []),
    [pag, servico],
  );
  const diasAbertos = useMemo(
    () => (pag && pag.horariosFuncionamento.length > 0 ? [...new Set(pag.horariosFuncionamento.map((h) => h.diaSemana))] : undefined),
    [pag],
  );

  const carregarHorarios = useCallback(async () => {
    if (!servico || !profId || !data) {
      setHorarios(null);
      return;
    }
    setHora('');
    try {
      const r = await api<{ horarios: string[] }>(
        `/estabelecimentos/${slug}/horarios?profissionalId=${profId}&servicoId=${servico.id}&data=${data}`,
      );
      setHorarios(r.horarios);
    } catch (e) {
      setAviso(mensagemDeErro(e));
    }
  }, [slug, servico, profId, data]);

  useEffect(() => {
    void carregarHorarios();
  }, [carregarHorarios]);

  function abrir(s: Servico) {
    setServico(s);
    setData('');
    setHora('');
    setHorarios(null);
    setAviso('');
    const candidatos = pag!.profissionais.filter((p) => p.servicoIds.includes(s.id));
    setProfId(candidatos.length === 1 ? candidatos[0].id : '');
  }

  function fechar() {
    setServico(null);
  }

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > window.innerHeight * 0.4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Esc fecha o modal; a página de trás não rola enquanto ele está aberto.
  useEffect(() => {
    if (!servico) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    primeiroCampo.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = anterior;
    };
  }, [servico]);

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pag || !servico) return;
    setAviso('');
    setEnviando(true);
    try {
      const r = await api<{ codigo: string }>('/agendamentos', {
        method: 'POST',
        body: {
          estabelecimentoId: pag.id,
          profissionalId: profId,
          servicoId: servico.id,
          nomeCliente: nome,
          whatsappCliente: whatsappE164(whatsapp),
          // "HH:mm" no fuso do Contratante → ISO UTC. O backend valida o horário contra a grade.
          dataHora: localParaUTC(data, hora, pag.fusoHorario),
        },
      });
      salvarCodigo(slug, r.codigo);
      setCodigo(r.codigo);
      setCancelado(false);
      setServico(null);
    } catch (err) {
      setAviso(mensagemDeErro(err));
      if (err instanceof ApiError && err.code === 'HORARIO_INDISPONIVEL') await carregarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar() {
    setErroCancelar('');
    try {
      await api(`/agendamentos/${codigo}/status`, { method: 'PATCH', body: { status: 'CANCELADO' } });
      setCancelado(true);
    } catch (e) {
      setErroCancelar(mensagemDeErro(e));
    }
  }

  if (indisponivel) {
    return (
      <main className="narrow">
        <h1>Agendamento temporariamente indisponível</h1>
        <p>Tente novamente mais tarde.</p>
      </main>
    );
  }
  if (!pag) {
    return <Carregando />;
  }

  if (codigo) {
    return (
      <TelaCodigo
        codigo={codigo}
        estado={cancelado ? 'CANCELADO' : 'CONFIRMADO'}
        whatsapp={pag.whatsapp}
        aviso={cancelado ? undefined : pag.mensagemCancelamento}
        erro={erroCancelar}
        onVoltar={() => { setCodigo(''); setCancelado(false); }}
        onCancelar={cancelar}
      />
    );
  }

  return (
    <div className="ag">
      <NavPublica slug={slug} nome={pag.nome} logoUrl={pag.logoUrl} ativo="home" />

      {/* 1ª tela: boas-vindas */}
      <section className="ag-hero" aria-labelledby="ag-bemvindo">
        <h1 id="ag-bemvindo">Bem-vindo!</h1>
        <p className="chamada">Agende o seu horário!</p>

        {pag.horariosFuncionamento.length > 0 && (
          <details>
            <summary>Horário de funcionamento</summary>
            {DIAS_SEMANA.map((dia, i) => {
              const j = pag.horariosFuncionamento.find((h) => h.diaSemana === i);
              return <p key={dia}><strong>{dia}:</strong> {j ? `${j.inicio} às ${j.fim}` : 'Fechado'}</p>;
            })}
          </details>
        )}

        <button
          type="button"
          className={`ag-descer${rolou ? ' sobe' : ''}`}
          aria-label={rolou ? 'Voltar ao topo' : 'Ver serviços'}
          onClick={() => (rolou ? window.scrollTo({ top: 0, behavior: 'smooth' }) : servicosRef.current?.scrollIntoView({ behavior: 'smooth' }))}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      </section>

      {/* 2ª tela: serviços */}
      <section className="ag-servicos" ref={servicosRef} aria-labelledby="ag-titulo-servicos">
        <h2 id="ag-titulo-servicos" className="sr-only">Serviços</h2>
        {pag.servicos.length === 0 && <p>Nenhum serviço disponível no momento.</p>}
        <div className="ag-grade">
          {pag.servicos.map((s) => {
            const foto = pag.catalogoPublico && s.fotoUrl ? s.fotoUrl : null;
            return (
              <article key={s.id} className={`ag-card${foto ? ' com-foto' : ''}`}>
                {foto && <img className="ag-foto" src={foto} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}
                <div className="ag-info">
                  <h3>{s.nome}</h3>
                  {pag.catalogoPublico && s.descricao && <p className="ag-desc">{s.descricao}</p>}
                  {pag.catalogoPublico && s.preco !== undefined && <p className="ag-preco">{brl(s.preco)}</p>}
                  <p className="ag-dur">{s.duracaoMinutos} min</p>
                  <button type="button" className="ag-btn" onClick={() => abrir(s)} aria-label={`Agendar ${s.nome}`}>Agendar</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {servico && (
        <div className="ag-overlay" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
          <div className="ag-modal" role="dialog" aria-modal="true" aria-labelledby="ag-modal-titulo">
            <button type="button" className="ag-x" onClick={fechar} aria-label="Fechar">x</button>
            <p className="servico-nome" id="ag-modal-titulo">{servico.nome} · {servico.duracaoMinutos} min</p>

            <form onSubmit={confirmar}>
              <label htmlFor="ag-prof">Profissional</label>
              <select id="ag-prof" ref={primeiroCampo} value={profId} onChange={(e) => setProfId(e.target.value)} required>
                <option value="">{profs.length === 0 ? 'Nenhum profissional disponível' : 'Escolher'}</option>
                {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>

              <div className="ag-cols">
                <div className="ag-col">
                  <h3 className="rotulo">Datas disponíveis</h3>
                  <Calendario valor={data} min={hoje()} diasAbertos={diasAbertos} onChange={setData} />

                  <label htmlFor="ag-hora">Horário</label>
                  <select id="ag-hora" value={hora} onChange={(e) => setHora(e.target.value)} required disabled={!horarios || horarios.length === 0}>
                    <option value="">
                      {!profId || !data ? 'Escolha profissional e data' : horarios?.length === 0 ? 'Sem horários livres' : 'Escolher'}
                    </option>
                    {horarios?.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="ag-col">
                  <label htmlFor="ag-nome">Seu nome</label>
                  <input id="ag-nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} maxLength={150} autoComplete="name" />

                  <label htmlFor="ag-num">Seu número</label>
                  <div className="ag-tel">
                    <span aria-hidden="true">+55</span>
                    <input
                      id="ag-num"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      required
                      placeholder="(82) 99999-0000"
                      value={whatsapp}
                      maxLength={15}
                      pattern="\(\d{2}\) \d{4,5}-\d{4}"
                      title="Informe DDD e número de WhatsApp. O código +55 já está incluído."
                      onChange={(e) => setWhatsapp(formatarWhatsapp(e.target.value))}
                    />
                  </div>

                  {aviso && <p className="ag-erro" role="alert">{aviso}</p>}
                  <button className="ag-btn grande" disabled={enviando || !hora}>
                    {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
                  </button>
                </div>
              </div>

              <p className="ag-politica" role="note"><strong>Política de cancelamento:</strong> {pag.mensagemCancelamento}</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
