'use client';
import { useRef } from 'react';
import LogoRedonda from '@/components/LogoRedonda';

export interface Ajuste { x: number; y: number; zoom: number }

const TAMANHO = 160; // px do círculo de edição
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Editor da logo redonda: arraste a imagem para posicionar, use o zoom e veja como fica no topo da página. */
export default function AjusteLogoEditor({ src, valor, onChange }: { src: string; valor: Ajuste; onChange: (a: Ajuste) => void }) {
  const arrasto = useRef<{ id: number; x: number; y: number } | null>(null);

  function mover(dx: number, dy: number) {
    const f = 100 / (TAMANHO * (valor.zoom / 100)); // arrastar a imagem para a direita = foco para a esquerda
    onChange({ ...valor, x: Math.round(limitar(valor.x - dx * f, 0, 100)), y: Math.round(limitar(valor.y - dy * f, 0, 100)) });
  }

  return (
    <div className="logo-editor">
      <div className="logo-editor-topo">
        <strong>Ajustar logo</strong>
        <span>Arraste a imagem para posicionar. Use o zoom para aproximar.</span>
      </div>

      <div className="logo-editor-corpo">
        <div
          className="logo-palco"
          style={{ width: TAMANHO, height: TAMANHO }}
          tabIndex={0}
          role="group"
          aria-label="Área de ajuste da logo. Use as setas do teclado para mover."
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); arrasto.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; }}
          onPointerMove={(e) => {
            const a = arrasto.current;
            if (!a || a.id !== e.pointerId) return;
            mover(e.clientX - a.x, e.clientY - a.y);
            arrasto.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { arrasto.current = null; }}
          onPointerCancel={() => { arrasto.current = null; }}
          onKeyDown={(e) => {
            const passo = 2;
            const d: Record<string, [number, number]> = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
            if (!d[e.key]) return;
            e.preventDefault();
            const f = 100 / (TAMANHO * (valor.zoom / 100));
            mover(d[e.key][0] / f, d[e.key][1] / f);
          }}
        >
          <LogoRedonda src={src} x={valor.x} y={valor.y} zoom={valor.zoom} tamanho={TAMANHO} />
          <span className="logo-guia" aria-hidden="true" />
        </div>

        <div className="logo-controles">
          <div className="logo-zoom">
            <label htmlFor="logo-zoom">Zoom</label>
            <div className="logo-zoom-linha">
              <button type="button" className="logo-mini" aria-label="Diminuir zoom" onClick={() => onChange({ ...valor, zoom: limitar(valor.zoom - 10, 100, 300) })}>−</button>
              <input id="logo-zoom" type="range" min={100} max={300} step={5} value={valor.zoom} onChange={(e) => onChange({ ...valor, zoom: Number(e.target.value) })} />
              <button type="button" className="logo-mini" aria-label="Aumentar zoom" onClick={() => onChange({ ...valor, zoom: limitar(valor.zoom + 10, 100, 300) })}>+</button>
              <output htmlFor="logo-zoom">{valor.zoom}%</output>
            </div>
          </div>

          <div className="logo-previa">
            <span>Como aparece no topo</span>
            <div className="logo-previa-barra">
              <LogoRedonda src={src} x={valor.x} y={valor.y} zoom={valor.zoom} tamanho={40} />
              <i /><i />
            </div>
          </div>

          <button type="button" className="sec" onClick={() => onChange({ x: 50, y: 50, zoom: 100 })}>Centralizar</button>
        </div>
      </div>
    </div>
  );
}
