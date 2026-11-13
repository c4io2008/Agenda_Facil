'use client';
import { useState } from 'react';

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const NOMES_DIA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const partes = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m: m - 1, d };
};

interface Props {
  /** Data escolhida (YYYY-MM-DD) ou vazio. */
  valor: string;
  /** Primeira data permitida (hoje). */
  min: string;
  maxDias?: number;
  /** Dias da semana (0 = domingo) em que o negócio abre; os outros ficam desabilitados. */
  diasAbertos?: number[];
  onChange: (data: string) => void;
}

export default function Calendario({ valor, min, maxDias = 90, diasAbertos, onChange }: Props) {
  const base = partes(valor || min);
  const [ref, setRef] = useState({ y: base.y, m: base.m });
  const pMin = partes(min);
  const limite = new Date(pMin.y, pMin.m, pMin.d + maxDias);
  const max = iso(limite.getFullYear(), limite.getMonth(), limite.getDate());

  const indice = ref.y * 12 + ref.m;
  const noPrimeiroMes = indice <= pMin.y * 12 + pMin.m;
  const noUltimoMes = indice >= limite.getFullYear() * 12 + limite.getMonth();
  const vazios = new Date(ref.y, ref.m, 1).getDay();
  const total = new Date(ref.y, ref.m + 1, 0).getDate();

  const mover = (n: number) => {
    const d = new Date(ref.y, ref.m + n, 1);
    setRef({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="ag-cal" role="group" aria-label="Datas disponíveis">
      <div className="ag-cal-topo">
        <button type="button" onClick={() => mover(-1)} disabled={noPrimeiroMes} aria-label="Mês anterior">‹</button>
        <span aria-live="polite">{MESES[ref.m]} {ref.y}</span>
        <button type="button" onClick={() => mover(1)} disabled={noUltimoMes} aria-label="Próximo mês">›</button>
      </div>
      <div className="ag-cal-caixa">
        <div className="ag-cal-semana" aria-hidden="true">
          {SEMANA.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="ag-cal-dias">
          {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
          {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
            const data = iso(ref.y, ref.m, d);
            const dow = new Date(ref.y, ref.m, d).getDay();
            const fora = data < min || data > max || (diasAbertos !== undefined && !diasAbertos.includes(dow));
            return (
              <button
                key={d}
                type="button"
                disabled={fora}
                aria-pressed={valor === data}
                aria-label={`${d} de ${MESES[ref.m]}, ${NOMES_DIA[dow]}`}
                onClick={() => onChange(data)}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
