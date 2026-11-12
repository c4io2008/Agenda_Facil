'use client';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, brl, hoje, localParaUTC, mensagemDeErro } from '@/lib/api';
import './page.css';

interface Pagina {
  id: string; nome: string; fusoHorario: string; catalogoPublico: boolean; tituloAgenda: string | null; logoUrl: string | null;
  servicos: { id: string; nome: string; duracaoMinutos: number; preco?: number; fotoUrl?: string }[];
  profissionais: { id: string; nome: string; servicoIds: string[] }[];
}

export default function Agendar() {
  const { slug } = useParams<{ slug: string }>();
  const [pag, setPag] = useState<Pagina | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [servicoId, setServicoId] = useState('');
  const [profId, setProfId] = useState('');
  const [data, setData] = useState(hoje());
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [hora, setHora] = useState('');
  const [aviso, setAviso] = useState('');
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    api<Pagina>(`/estabelecimentos/${slug}`).then(setPag).catch(() => setIndisponivel(true));
  }, [slug]);

  const carregarHorarios = useCallback(async () => {
    if (!servicoId || !profId) return;
    setHora('');
    try {
      const r = await api<{ horarios: string[] }>(`/estabelecimentos/${slug}/horarios?profissionalId=${profId}&servicoId=${servicoId}&data=${data}`);
      setHorarios(r.horarios);
    } catch (e) { setAviso(mensagemDeErro(e)); }
  }, [slug, servicoId, profId, data]);

  useEffect(() => { void carregarHorarios(); }, [carregarHorarios]);

  async function confirmar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setAviso('');
    // "HH:mm" local do Contratante → ISO UTC. O backend valida o horário contra a grade.
    const dataHora = localParaUTC(data, hora, pag!.fusoHorario);
    try {
      const r = await api<{ codigo: string }>('/agendamentos', {
        method: 'POST',
        body: { estabelecimentoId: pag!.id, profissionalId: profId, servicoId, nomeCliente: f.get('nome'), whatsappCliente: f.get('whatsapp'), dataHora },
      });
      setCodigo(r.codigo);
    } catch (err) {
      setAviso(mensagemDeErro(err));
      if (err instanceof ApiError && err.code === 'HORARIO_INDISPONIVEL') await carregarHorarios(); // UC006.FS001
    }
  }

  if (indisponivel) return <main className="narrow pub-agendar"><h1>Agendamento temporariamente indisponível</h1><p>Tente novamente mais tarde.</p></main>;
  if (!pag) return <main className="narrow pub-agendar"><p>Carregando…</p></main>;

  if (codigo) {
    return (
      <main className="narrow">
        <h1>Agendamento confirmado</h1>
        <div className="card">
          <p>Seu código:</p><p className="preco">{codigo}</p>
          <p><a href={`/cancelar/${codigo}`}>Precisa cancelar? Use este link.</a></p>
          <p>Guarde o código: ele é a única forma de cancelar ou consultar o agendamento.</p>
        </div>
      </main>
    );
  }

  const profs = pag.profissionais.filter((p) => p.servicoIds.includes(servicoId));
  return (
    <main className="narrow">
      {pag.logoUrl && <img src={pag.logoUrl} alt={`Logo de ${pag.nome}`} className="pub-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
      <h1>{pag.nome}</h1>
      <p className="pub-sub">{pag.tituloAgenda || 'Agende seu horário'}</p>
      <h2>1. Escolha o serviço</h2>
      <div role="radiogroup" aria-label="Serviço">
        {pag.servicos.map((s) => (
          <label key={s.id} className="card" style={{ cursor: 'pointer' }}>
            <input type="radio" name="servico" checked={servicoId === s.id} onChange={() => { setServicoId(s.id); setProfId(''); setHorarios(null); }} style={{ width: 'auto' }} />{' '}
            <strong>{s.nome}</strong> · {s.duracaoMinutos} min {pag.catalogoPublico && s.preco !== undefined && <> · {brl(s.preco)}</>}
            {pag.catalogoPublico && s.fotoUrl && <img src={s.fotoUrl} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginTop: 8 }} />}
          </label>
        ))}
      </div>
      {servicoId && (
        <>
          <h2>2. Profissional</h2>
          {profs.length === 0 && <p>Nenhum profissional disponível para este serviço.</p>}
          <select aria-label="Profissional" value={profId} onChange={(e) => setProfId(e.target.value)}>
            <option value="">Selecione…</option>
            {profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </>
      )}
      {profId && (
        <>
          <h2>3. Dia e horário</h2>
          <input type="date" aria-label="Data" min={hoje()} value={data} onChange={(e) => setData(e.target.value)} />
          <div className="slots" style={{ marginTop: '.75rem' }}>
            {horarios?.length === 0 && <p>Sem horários livres neste dia.</p>}
            {horarios?.map((h) => <button key={h} type="button" aria-pressed={hora === h} onClick={() => setHora(h)}>{h}</button>)}
          </div>
        </>
      )}
      {hora && (
        <form onSubmit={confirmar} className="card" style={{ marginTop: '1rem' }}>
          <h2>4. Seus dados</h2>
          <label htmlFor="nome">Nome</label>
          <input id="nome" name="nome" required minLength={3} maxLength={150} />
          <label htmlFor="whatsapp">WhatsApp (ex: +5582999990000)</label>
          <input id="whatsapp" name="whatsapp" required pattern="\+[1-9][0-9]{7,14}" inputMode="tel" />
          {aviso && <p className="erro" role="alert">{aviso}</p>}
          <p><button>Confirmar agendamento às {hora}</button></p>
        </form>
      )}
      {!hora && aviso && <p className="erro" role="alert">{aviso}</p>}
    </main>
  );
}
