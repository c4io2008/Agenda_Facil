'use client';
import { useCallback, useEffect, useState } from 'react';
import PainelShell from '@/components/PainelShell'; 
import { api, brl, mensagemDeErro } from '@/lib/api';
import './page.css';

interface Ass {
  plano: string; status: string; valorMensal: number; proximaCobranca: string | null; planoAgendado: string | null; cancelamentoAgendado: boolean;
  planosDisponiveis: { plano: string; preco: number; whatsapp: boolean; catalogoPublico: boolean }[];
}
interface Cob { id: string; valor: number; vencimento: string; status: string }
const NOME: Record<string, string> = { BASICO: 'Básico', PROFISSIONAL: 'Profissional', PREMIUM: 'Premium' };

export default function Assinatura() {
  const [ass, setAss] = useState<Ass | null>(null);
  const [cobs, setCobs] = useState<Cob[]>([]);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setAss(await api<Ass>('/assinatura', { auth: 'contratante' }));
      setCobs((await api<{ itens: Cob[] }>('/cobrancas', { auth: 'contratante' })).itens);
    } catch (e) { setErro(mensagemDeErro(e)); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function mudar(plano: string) {
    setMsg(''); setErro('');
    try {
      const r = await api<{ tipo: string; efetivoEm: string }>('/assinatura/mudar-plano', { method: 'POST', auth: 'contratante', body: { plano } });
      setMsg(r.tipo === 'UPGRADE' ? 'Upgrade aplicado agora.' : `Downgrade agendado para ${new Date(r.efetivoEm).toLocaleDateString('pt-BR')}.`);
      await carregar();
    } catch (e) { setErro(mensagemDeErro(e)); }
  }
  async function cancelar() {
    if (!confirm('Cancelar a assinatura? O serviço continua até o fim do ciclo pago.')) return;
    try { const r = await api<{ cancelamentoEm: string | null }>('/assinatura/cancelar', { method: 'POST', auth: 'contratante' }); setMsg(`Cancelamento agendado${r.cancelamentoEm ? ` para ${r.cancelamentoEm}` : ''}.`); await carregar(); }
    catch (e) { setErro(mensagemDeErro(e)); }
  }

  return (
    
<PainelShell>
  <div className="painel-assinatura">
    <h1 className="agenda-titulo">Assinatura</h1>
      {msg && <p className="ok" role="status">{msg}</p>}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ass && (
        <>
          <div className="card">
            <p>Plano atual: <strong>{NOME[ass.plano]}</strong> · {brl(ass.valorMensal)}/mês · <span className="tag">{ass.status}</span></p>
            {ass.proximaCobranca && <p>Próxima cobrança: {new Date(ass.proximaCobranca + 'T00:00:00').toLocaleDateString('pt-BR')}</p>}
            {ass.planoAgendado && <p className="aviso">Mudança para {NOME[ass.planoAgendado]} agendada para o próximo ciclo.</p>}
            {ass.cancelamentoAgendado && <p className="aviso">Cancelamento agendado para o fim do ciclo.</p>}
          </div>
          <div className="grid">
            {ass.planosDisponiveis.map((p) => (
              <section key={p.plano} className="card">
                <h2>{NOME[p.plano]}</h2>
                <div className="preco">{brl(p.preco)}</div>
                <ul><li>Agenda online</li>{p.whatsapp && <li>Lembretes por WhatsApp</li>}{p.catalogoPublico && <li>Catálogo com preços e fotos</li>}</ul>
                {p.plano === ass.plano ? <span className="tag">Plano atual</span> :
                  <button onClick={() => mudar(p.plano)}>{p.preco > ass.valorMensal ? 'Fazer upgrade' : 'Fazer downgrade'}</button>}
              </section>
            ))}
          </div>
          <p><button className="perigo" onClick={cancelar} disabled={ass.status === 'CANCELADA' || ass.cancelamentoAgendado}>Cancelar assinatura</button></p>
          <h2>Histórico de cobranças</h2>
          {cobs.length === 0 && <p>Nenhuma cobrança gerada ainda.</p>}
          {cobs.map((c) => (
            <div key={c.id} className="card linha">
              <span>{new Date(c.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')} · {brl(c.valor)}</span><span className="tag">{c.status}</span>
            </div>
          ))}
        </>
      )}
    </div>  
    </PainelShell>
  );
}
