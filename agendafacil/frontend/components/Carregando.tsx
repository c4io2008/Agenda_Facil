import '@/app/agendar/agendar.css';

/** Tela de carregamento com spinner. `compacto` = só o spinner, dentro de uma página já montada; `sobreposto` = cobre a tela toda (a página continua carregando por baixo). */
export default function Carregando({ compacto = false, sobreposto = false }: { compacto?: boolean; sobreposto?: boolean }) {
  const spinner = (
    <div className="ag-spinner-area" role="status" aria-live="polite">
      <span className="ag-spinner" aria-hidden="true" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
  if (compacto) return spinner;
  return <div className={`ag ag-carregando${sobreposto ? ' ag-carregando-fixo' : ''}`}>{spinner}</div>;
}
