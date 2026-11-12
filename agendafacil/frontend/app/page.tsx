'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import './landing.css';

const PLANOS = [
  { id: 'BASICO', nome: 'Básico', preco: '49,00', recursos: <>Agenda online</> },
  { id: 'PROFISSIONAL', nome: 'Profissional', preco: '79,00', recursos: <>Agenda online<br /><span className="mais">+</span> Whatsapp</> },
  { id: 'PREMIUM', nome: 'Premium', preco: '129,00', recursos: <>Agenda online<br /><span className="mais">+</span> Whatsapp <span className="mais">+</span><br />Catálogo público</> },
];

/** Estrela de 12 pontas: 6 retângulos cruzando o centro, girados de 30° em 30°. */
function Estrela() {
  return (
    <svg className="lp-estrela" viewBox="-100 -100 200 200" aria-hidden="true">
      {[0, 30, 60, 90, 120, 150].map((g) => (
        <rect key={g} x="-17" y="-100" width="34" height="200" transform={`rotate(${g})`} />
      ))}
    </svg>
  );
}

export default function Home() {
  const raiz = useRef<HTMLDivElement>(null);
  const planos = useRef<HTMLElement>(null);

  // Revela os planos quando a seção entra na tela (a seção 1 aparece primeiro).
  useEffect(() => {
    const alvos = raiz.current?.querySelectorAll('.lp-revela');
    if (!alvos || !raiz.current) return;
    const io = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => e.isIntersecting && e.target.classList.add('visivel')),
      { root: raiz.current, threshold: 0.25 },
    );
    alvos.forEach((a) => io.observe(a));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp" ref={raiz}>
      <section className="lp-slide lp-hero" aria-label="Apresentação">
        <div className="lp-hero-texto">
          <h1>Automatize seu negócio!</h1>
        </div>
        <div className="lp-hero-marca">
          <Estrela />
          <div className="lp-logo" role="img" aria-label="AgendaFácil">
            <span className="agenda">AGENDA</span>
            <span className="facil">
              FÁCIL
              <svg viewBox="0 0 64 64">
                <rect x="6" y="12" width="52" height="46" rx="6" />
                <path d="M6 26h52M20 6v12M44 6v12M22 42l8 8 14-16" />
              </svg>
            </span>
          </div>
        </div>
        <button className="lp-descer" aria-label="Ver planos" onClick={() => planos.current?.scrollIntoView({ behavior: 'smooth' })}>↓</button>
      </section>

      <section className="lp-slide lp-planos" ref={planos} aria-labelledby="titulo-planos">
        <h2 id="titulo-planos" className="lp-revela">Planos Disponíveis</h2>
        <div className="lp-cards">
          {PLANOS.map((p) => (
            <article key={p.id} className="lp-card lp-revela">
              <h3>{p.nome}</h3>
              <hr />
              <p className="recursos">{p.recursos}</p>
              <p className="preco">R$ {p.preco}/Por mês</p>
              <Link className="lp-botao" href={`/cadastro?plano=${p.id}`}>Começar com o {p.nome}</Link>
            </article>
          ))}
        </div>
        <p className="lp-entrar">Já possui uma conta? <Link href="/login">Entrar</Link></p>
      </section>
    </div>
  );
}
