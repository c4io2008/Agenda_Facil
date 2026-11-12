
export const TEMAS = [
  { id: 'lima', nome: 'Lima', cores: ['#000000', '#d6ff72', '#86e05a'] },
  { id: 'oceano', nome: 'Oceano', cores: ['#050b14', '#5ee7ff', '#3b82f6'] },
  { id: 'rosa', nome: 'Rosa neon', cores: ['#0d0509', '#ff8ad8', '#c084fc'] },
  { id: 'ambar', nome: 'Âmbar', cores: ['#0f0a03', '#ffc857', '#ff9f1c'] },
  { id: 'claro', nome: 'Claro', cores: ['#f4f6f5', '#0b6e5b', '#12a37f'] },
] as const;

export type TemaId = (typeof TEMAS)[number]['id'];

export const TEMA_PADRAO: TemaId = 'lima';

export function aplicarTema(id?: string | null) {
  if (typeof document === 'undefined') return;

  const valido = TEMAS.some((t) => t.id === id)
    ? (id as TemaId)
    : TEMA_PADRAO;

  document.documentElement.dataset.tema = valido;

  try {
    localStorage.setItem('tema', valido);
  } catch {
    // ignora
  }
}

export function temaSalvo(): string | null {
  try {
    return localStorage.getItem('tema');
  } catch {
    return null;
  }
}

export function limparTema() {
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-tema');
  }
}
