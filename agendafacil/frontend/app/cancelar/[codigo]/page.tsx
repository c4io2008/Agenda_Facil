'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, mensagemDeErro } from '@/lib/api';

interface Ag {
  codigo: string; status: 'CONFIRMADO' | 'CANCELADO'; dataHora: string;
  servico: { nome: string }; profissional: { nome: string }; estabelecimento: { nome: string; slug: string };
}

export default function Cancelar() {
  const { codigo } = useParams<{ codigo: string }>();
  const [ag, setAg] = useState<Ag | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api<Ag>(`/agendamentos/${codigo}`).then(setAg).catch((e) => setErro(mensagemDeErro(e)));
  }, [codigo]);

  async function cancelar() {
    setErro('');
    try {
      await api(`/agendamentos/${codigo}/status`, { method: 'PATCH', body: { status: 'CANCELADO' } });
      setAg((a) => (a ? { ...a, status: 'CANCELADO' } : a));
    } catch (e) { setErro(mensagemDeErro(e)); }
  }

  if (!ag) return <main className="narrow">{erro ? <p className="erro" role="alert">{erro}</p> : <p>Carregando…</p>}</main>;
  const quando = new Date(ag.dataHora).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Maceio' });
  return (
    <main className="narrow">
      <h1>{ag.status === 'CANCELADO' ? 'Agendamento cancelado' : 'Cancelar agendamento'}</h1>
      <div className="card">
        <p><strong>{ag.estabelecimento.nome}</strong></p>
        <p>{ag.servico.nome} com {ag.profissional.nome}</p>
        <p>{quando}</p>
        <p>Código: {ag.codigo}</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ag.status === 'CONFIRMADO' ? (
        <p>
          <button className="perigo" onClick={cancelar}>Cancelar agendamento</button>{' '}
          <a className="btn sec" href={`/agendar/${ag.estabelecimento.slug}`}>Voltar</a>
        </p>
      ) : <p><a className="btn" href={`/agendar/${ag.estabelecimento.slug}`}>Agendar novo horário</a></p>}
    </main>
  );
}
