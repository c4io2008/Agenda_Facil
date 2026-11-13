'use client';
import { useState } from 'react';
import '@/app/agendar/agendar.css';

interface Props {
  codigo: string;
  estado: 'CONFIRMADO' | 'CANCELADO';
  /** O Contratante tem WhatsApp (plano Profissional/Premium)? Define o texto de apoio. */
  whatsapp: boolean;
  /** Política de cancelamento do Contratante. */
  aviso?: string;
  erro?: string;
  voltarHref?: string;
  onVoltar?: () => void;
  onCancelar: () => Promise<void>;
  children?: React.ReactNode;
}

/** Tela "Agendamento confirmado!" com o código e o fluxo "Cancelar agendamento → Sim / Não". */
export default function TelaCodigo({ codigo, estado, whatsapp, aviso, erro, voltarHref, onVoltar, onCancelar, children }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function sim() {
    setEnviando(true);
    try {
      await onCancelar();
    } finally {
      setEnviando(false);
      setConfirmando(false);
    }
  }

  const seta = (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 6l-6 6 6 6" /></svg>
  );

  return (
    <div className="ag ag-codigo">
      {voltarHref ? (
        <a className="ag-voltar" href={voltarHref} aria-label="Voltar">{seta}</a>
      ) : (
        <button type="button" className="ag-voltar" onClick={onVoltar} aria-label="Voltar">{seta}</button>
      )}

      <main>
        <h1>{estado === 'CANCELADO' ? 'Agendamento cancelado' : 'Agendamento confirmado!'}</h1>

        {children}

        <div className="ag-caixa">
          <div>
            <p className="ag-rotulo">Seu código:</p>
            <p className="ag-cod">{codigo}</p>
          </div>
          {estado === 'CONFIRMADO' && (
            <button type="button" className="ag-btn" onClick={() => setConfirmando(true)} disabled={confirmando}>
              Cancelar agendamento
            </button>
          )}
        </div>

        {estado === 'CONFIRMADO' && (
          <p className="ag-nota">
            {whatsapp
              ? 'Uma mensagem foi enviada em seu whatsapp, caso deseje cancelar acesse ao link que você recebeu.'
              : 'Guarde este código: ele é necessário para consultar ou cancelar o agendamento.'}
          </p>
        )}

        {confirmando && (
          <div className="ag-caixa" role="alertdialog" aria-label="Confirmar cancelamento">
            <p className="ag-pergunta">Seu agendamento será cancelado.<br />Você tem certeza?</p>
            <div className="ag-sim-nao">
              <button type="button" className="ag-btn perigo" onClick={sim} disabled={enviando}>Sim</button>
              <button type="button" className="ag-btn neutro" onClick={() => setConfirmando(false)} disabled={enviando}>Não</button>
            </div>
          </div>
        )}

        {erro && <p className="ag-erro" role="alert">{erro}</p>}
        {aviso && <p className="ag-politica" role="note"><strong>Política de cancelamento:</strong> {aviso}</p>}
      </main>
    </div>
  );
}
