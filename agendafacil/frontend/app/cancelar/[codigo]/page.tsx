'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Carregando from '@/components/Carregando';
import TelaCodigo from '@/components/TelaCodigo';
import { api, mensagemDeErro } from '@/lib/api';
import { aplicarTema, limparTema } from '@/lib/temas';
import '../../agendar/agendar.css';

interface Ag {
  codigo: string; status: 'CONFIRMADO' | 'CANCELADO'; dataHora: string;
  servico: { nome: string }; profissional: { nome: string }; estabelecimento: { nome: string; slug: string };
}
interface PaginaResumo { tema?: string; whatsapp?: boolean; mensagemCancelamento?: string }

export default function Cancelar() {
  const { codigo } = useParams<{ codigo: string }>();
  const [ag, setAg] = useState<Ag | null>(null);
  const [extra, setExtra] = useState<PaginaResumo>({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    api<Ag>(`/agendamentos/${codigo}`).then(setAg).catch((e) => setErro(mensagemDeErro(e)));
  }, [codigo]);

  // Tema, política e aviso de WhatsApp vêm da página pública do Contratante (se estiver indisponível, usa o padrão).
  useEffect(() => {
    if (!ag) return;
    api<PaginaResumo>(`/estabelecimentos/${ag.estabelecimento.slug}`)
      .then((p) => { setExtra(p); aplicarTema(p.tema); })
      .catch(() => aplicarTema(null));
    return () => limparTema();
  }, [ag?.estabelecimento.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancelar() {
    setErro('');
    try {
      await api(`/agendamentos/${codigo}/status`, { method: 'PATCH', body: { status: 'CANCELADO' } });
      setAg((a) => (a ? { ...a, status: 'CANCELADO' } : a));
    } catch (e) { setErro(mensagemDeErro(e)); }
  }

  if (!ag) {
    if (!erro) return <Carregando />;
    return (
      <div className="ag">
        <main style={{ padding: '2rem' }}><p className="ag-erro" role="alert">{erro}</p></main>
      </div>
    );
  }

  const quando = new Date(ag.dataHora).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Maceio' });
  return (
    <TelaCodigo
      codigo={ag.codigo}
      estado={ag.status}
      whatsapp={!!extra.whatsapp}
      aviso={ag.status === 'CONFIRMADO' ? extra.mensagemCancelamento : undefined}
      erro={erro}
      voltarHref={`/agendar/${ag.estabelecimento.slug}`}
      onCancelar={cancelar}
    >
      <div className="ag-detalhes">
        <p><strong>{ag.estabelecimento.nome}</strong></p>
        <p>{ag.servico.nome} com {ag.profissional.nome}</p>
        <p>{quando}</p>
      </div>
    </TelaCodigo>
  );
}
