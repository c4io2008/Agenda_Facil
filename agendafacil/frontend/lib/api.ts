const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { campo: string; mensagem: string }[]) {
    super(message);
  }
}

const CHAVE = { contratante: 'af_token', plataforma: 'af_token_plataforma' } as const;
export type Superficie = keyof typeof CHAVE;

export const tokens = {
  ler: (s: Superficie) => (typeof window === 'undefined' ? null : window.localStorage.getItem(CHAVE[s])),
  gravar: (s: Superficie, t: string) => window.localStorage.setItem(CHAVE[s], t),
  limpar: (s: Superficie) => window.localStorage.removeItem(CHAVE[s]),
};

export async function api<T = unknown>(
  caminho: string,
  opts: { method?: string; body?: unknown; auth?: Superficie } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const t = tokens.ler(opts.auth);
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${caminho}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, dados.error ?? 'ERRO', dados.message ?? 'Algo deu errado.', dados.details);
  return dados as T;
}

export const mensagemDeErro = (e: unknown) => (e instanceof ApiError ? e.message : 'Não foi possível conectar. Tente novamente.');
export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const hoje = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local

/** "YYYY-MM-DD" + "HH:mm" no fuso do Contratante → ISO UTC (sem depender do fuso do navegador). */
export function localParaUTC(data: string, hora: string, fuso: string): string {
  const [y, m, d] = data.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const alvo = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const noFuso = (t: number) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  };
  const offset = noFuso(alvo) - alvo; // diferença do fuso em relação a UTC naquele instante
  return new Date(alvo - offset).toISOString();
}
