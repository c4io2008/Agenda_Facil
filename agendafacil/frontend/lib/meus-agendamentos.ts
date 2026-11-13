/** Guarda, neste navegador, os códigos dos agendamentos feitos (o Cliente Final não tem conta). */
const chave = (slug: string) => `af_meus_${slug}`;

export function lerCodigos(slug: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(chave(slug)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function salvarCodigo(slug: string, codigo: string) {
  try {
    const lista = [codigo, ...lerCodigos(slug).filter((c) => c !== codigo)].slice(0, 30);
    window.localStorage.setItem(chave(slug), JSON.stringify(lista));
  } catch {
    /* navegador sem localStorage: o código continua aparecendo na tela de confirmação */
  }
}
