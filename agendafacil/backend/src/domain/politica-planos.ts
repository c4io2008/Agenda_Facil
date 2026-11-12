/** Fonte única da verdade sobre recursos por plano (SPECIFICATION §3.3). */
export const POLITICA_PLANOS = {
  BASICO: { preco: 49, whatsapp: false, catalogoPublico: false, logoPersonalizada: false },
  PROFISSIONAL: { preco: 79, whatsapp: true, catalogoPublico: false, logoPersonalizada: true },
  PREMIUM: { preco: 129, whatsapp: true, catalogoPublico: true, logoPersonalizada: true },
} as const;

export type Plano = keyof typeof POLITICA_PLANOS;
export const PLANOS = Object.keys(POLITICA_PLANOS) as Plano[];
