'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, tokens } from '@/lib/api';
import { aplicarTema, limparTema, temaSalvo } from '@/lib/temas';
import './PainelShell.css';


export interface Assinatura {
  plano: string; status: string; valorMensal: number; proximaCobranca: string | null;
  recursos: { whatsapp: boolean; catalogoPublico: boolean };
}

/** Navegação + banners de assinatura (EM_ATRASO / SUSPENSA = somente leitura). */
export default function PainelShell({ children, onAssinatura }: { children: React.ReactNode; onAssinatura?: (a: Assinatura) => void }) {
  const router = useRouter();
  const [ass, setAss] = useState<Assinatura | null>(null);
  const [marca, setMarca] = useState<{ nome: string; logoUrl: string | null } | null>(null);
  useEffect(() => { aplicarTema(temaSalvo()); return () => limparTema(); }, []);
  useEffect(() => {
    if (!tokens.ler('contratante')) { router.replace('/login'); return; }
    api<Assinatura>('/assinatura', { auth: 'contratante' })
      .then((a) => { setAss(a); onAssinatura?.(a); })
      .catch(() => { tokens.limpar('contratante'); router.replace('/login'); });
    api<{ nome: string; logoUrl: string | null; tema: string }>('/estabelecimentos/me', { auth: 'contratante' })
  .then((m) => { setMarca(m); aplicarTema(m.tema); })
  .catch(() => {});
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <nav className="nav" aria-label="Painel">
        <span className="marca">
          {marca?.logoUrl && <img src={marca.logoUrl} alt="" className="marca-logo" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        </span>
        <Link href="/painel">Agenda</Link>
        <Link href="/painel/configuracoes">Configurações</Link>
        <Link href="/painel/assinatura">Assinatura</Link>
        <button className="sec sp" onClick={() => { tokens.limpar('contratante'); router.push('/login'); }}>Sair</button>
      </nav>
      <main>
        {ass?.status === 'EM_ATRASO' && (
          <div className="aviso" role="alert">Há uma cobrança em atraso. Regularize para não perder o acesso. <Link href="/painel/assinatura">Ver assinatura</Link></div>
        )}
        {(ass?.status === 'SUSPENSA' || ass?.status === 'CANCELADA') && (
          <div className="aviso grave" role="alert">Seu painel está em modo somente leitura e a página de agendamento está fora do ar. <Link className="btn" href="/painel/assinatura">Regularizar assinatura</Link></div>
        )}
        {children}
      </main>
    </>
  );
}
