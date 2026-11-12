'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, brl, mensagemDeErro, tokens } from '@/lib/api';

interface Linha { id: string; nome: string; slug: string; plano: string; status: string; statusAssinatura: string | null; proximaCobranca: string | null }
interface Metricas { contratantesAtivos: number; mrr: number; assinaturasEmAtraso: number; notificacoesEnviadas30d: number; notificacoesComFalha30d: number; contratantesPorPlano: Record<string, number> }

/** Backoffice da equipe AgendaFácil: só dados agregados, nunca dados de Cliente Final. */
export default function Plataforma() {
  const [logado, setLogado] = useState(false);
  const [lista, setLista] = useState<Linha[]>([]);
  const [m, setM] = useState<Metricas | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setLista((await api<{ itens: Linha[] }>(`/plataforma/estabelecimentos?busca=${encodeURIComponent(busca)}`, { auth: 'plataforma' })).itens);
      setM(await api<Metricas>('/plataforma/metricas', { auth: 'plataforma' }).catch(() => null)); // SUPORTE não vê métricas
      setErro('');
    } catch (e) { setErro(mensagemDeErro(e)); }
  }, [busca]);

  useEffect(() => { if (tokens.ler('plataforma')) { setLogado(true); void carregar(); } }, [carregar]);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    try {
      const r = await api<{ token: string }>('/plataforma/auth/login', { method: 'POST', body: { email: f.get('email'), senha: f.get('senha') } });
      tokens.gravar('plataforma', r.token); setLogado(true); await carregar();
    } catch (err) { setErro(mensagemDeErro(err)); }
  }

  async function alterar(id: string, status: 'ATIVO' | 'SUSPENSO') {
    if (!confirm(status === 'SUSPENSO' ? 'Suspender este Contratante?' : 'Reativar este Contratante?')) return;
    try { await api(`/plataforma/estabelecimentos/${id}/status`, { method: 'PATCH', auth: 'plataforma', body: { status } }); await carregar(); }
    catch (e) { setErro(mensagemDeErro(e)); }
  }

  if (!logado) {
    return (
      <main className="narrow">
        <h1>Backoffice</h1>
        <form className="card" onSubmit={entrar}>
          <label htmlFor="e">E-mail</label><input id="e" name="email" type="email" required />
          <label htmlFor="s">Senha</label><input id="s" name="senha" type="password" required />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <p><button>Entrar</button></p>
        </form>
      </main>
    );
  }

  return (
    <main>
      <div className="linha"><h1>Contratantes</h1><button className="sec" onClick={() => { tokens.limpar('plataforma'); setLogado(false); }}>Sair</button></div>
      {m && (
        <div className="grid">
          <div className="card"><strong>{m.contratantesAtivos}</strong><br />ativos</div>
          <div className="card"><strong>{brl(m.mrr)}</strong><br />MRR</div>
          <div className="card"><strong>{m.assinaturasEmAtraso}</strong><br />em atraso</div>
          <div className="card"><strong>{m.notificacoesEnviadas30d}</strong> enviadas / <strong>{m.notificacoesComFalha30d}</strong> com falha<br />WhatsApp, 30 dias</div>
        </div>
      )}
      <label htmlFor="b">Buscar por nome, link ou e-mail</label>
      <input id="b" value={busca} onChange={(e) => setBusca(e.target.value)} />
      {erro && <p className="erro" role="alert">{erro}</p>}
      {lista.map((c) => (
        <div key={c.id} className="card linha">
          <div><strong>{c.nome}</strong> <small>/{c.slug}</small><br />{c.plano} · conta {c.status} · assinatura {c.statusAssinatura ?? '—'}</div>
          {c.status === 'ATIVO' && <button className="perigo" onClick={() => alterar(c.id, 'SUSPENSO')}>Suspender</button>}
          {c.status === 'SUSPENSO' && <button onClick={() => alterar(c.id, 'ATIVO')}>Reativar</button>}
        </div>
      ))}
    </main>
  );
}
