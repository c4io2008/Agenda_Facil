'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Carregando from '@/components/Carregando';
import NavPublica from '@/components/NavPublica';
import { api } from '@/lib/api';
import { lerCodigos } from '@/lib/meus-agendamentos';
import { aplicarTema, limparTema } from '@/lib/temas';
import '../../agendar.css';

interface Marca { nome: string; logoUrl: string | null; tema: string }
interface Ag {
  codigo: string;
  status: 'CONFIRMADO' | 'CANCELADO';
  dataHora: string;
  servico: { nome: string };
  profissional: { nome: string };
  estabelecimento: { slug: string };
}

export default function MeusAgendamentos() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [marca, setMarca] = useState<Marca | null>(null);
  const [itens, setItens] = useState<Ag[] | null>(null);
  const [codigo, setCodigo] = useState('');

  useEffect(() => {
    api<Marca & { fusoHorario: string }>(`/estabelecimentos/${slug}`)
      .then((m) => { setMarca(m); aplicarTema(m.tema); })
      .catch(() => setMarca({ nome: 'Agendamentos', logoUrl: null, tema: 'lima' }));
    return () => limparTema();
  }, [slug]);

  useEffect(() => {
    const codigos = lerCodigos(slug);
    Promise.all(codigos.map((c) => api<Ag>(`/agendamentos/${c}`).catch(() => null))).then((rs) =>
      setItens(rs.filter((r): r is Ag => r !== null && r.estabelecimento.slug === slug)),
    );
  }, [slug]);

  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Maceio' });

  return (
    <div className="ag">
      <NavPublica slug={slug} nome={marca?.nome ?? ''} logoUrl={marca?.logoUrl} ativo="meus" />
      <main className="ag-meus">
        <h1>Meus agendamentos</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (codigo.trim()) router.push(`/cancelar/${codigo.trim().toUpperCase()}`);
          }}
        >
          <label className="sr-only" htmlFor="ag-cod">Código do agendamento</label>
          <input id="ag-cod" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Digite o código do agendamento" maxLength={12} />
          <button className="ag-btn">Buscar</button>
        </form>

        {itens === null && <Carregando compacto />}
        {itens?.length === 0 && <p>Nenhum agendamento salvo neste aparelho. Se você tem um código, digite acima.</p>}
        {itens?.map((a) => (
          <article key={a.codigo} className="ag-item">
            <div>
              <p><strong>{a.servico.nome}</strong> com {a.profissional.nome}
                <span className={`ag-tag${a.status === 'CANCELADO' ? ' cancelado' : ''}`}>{a.status === 'CANCELADO' ? 'Cancelado' : 'Confirmado'}</span>
              </p>
              <p>{quando(a.dataHora)} · código {a.codigo}</p>
            </div>
            <Link className="ag-btn" href={`/cancelar/${a.codigo}`}>{a.status === 'CONFIRMADO' ? 'Ver / cancelar' : 'Ver'}</Link>
          </article>
        ))}
      </main>
    </div>
  );
}
