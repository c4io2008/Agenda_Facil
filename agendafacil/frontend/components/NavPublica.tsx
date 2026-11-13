'use client';
import Link from 'next/link';
import LogoRedonda from '@/components/LogoRedonda';
import '@/app/agendar/agendar.css';

interface Props {
  slug: string;
  nome: string;
  logoUrl?: string | null;
  ativo: 'home' | 'meus';
}

/** Barra de navegação das páginas do Cliente Final (segue o tema do Contratante). */
export default function NavPublica({ slug, nome, logoUrl, ativo }: Props) {
  return (
    <header className="ag-nav">
      <span className="ag-marca">
        {logoUrl && <LogoRedonda src={logoUrl} />}
        <strong>{nome}</strong>
      </span>
      <nav aria-label="Navegação">
        <Link
          href={`/agendar/${slug}`}
          aria-current={ativo === 'home' ? 'page' : undefined}
          onClick={(e) => {
            if (ativo === 'home') {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        >
          Home
        </Link>
        <Link href={`/agendar/${slug}/meus`} aria-current={ativo === 'meus' ? 'page' : undefined}>Meus agendamentos</Link>
      </nav>
    </header>
  );
}
