/** Máscara "(82) 99999-0000" para o WhatsApp; o +55 é fixo na tela e adicionado no envio. */
export function formatarWhatsapp(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const numero = d.slice(2);
  const corte = numero.length === 9 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

export const whatsappE164 = (valor: string) => `+55${valor.replace(/\D/g, '')}`;
