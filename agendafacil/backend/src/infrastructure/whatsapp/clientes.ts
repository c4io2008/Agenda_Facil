import type { WhatsAppGateway } from '../../application/ports';

/**
 * WhatsApp Business Cloud API. Observação: mensagens iniciadas pela empresa fora da janela de 24h
 * exigem templates aprovados; troque `type: 'text'` por `type: 'template'` quando os templates existirem.
 */
export class WhatsAppCloudApi implements WhatsAppGateway {
  constructor(private token: string, private phoneNumberId: string) {}

  async enviar(para: string, texto: string): Promise<void> {
    const res = await fetch(`https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: para.replace(/\D/g, ''),
        type: 'text',
        text: { body: texto },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    // Só o status HTTP vai para o erro: o corpo pode conter dados do destinatário.
    if (!res.ok) throw new Error(`WhatsApp API respondeu ${res.status}`);
  }
}

/** Dev sem credenciais: não envia nada e não registra telefone nem conteúdo. */
export class WhatsAppConsole implements WhatsAppGateway {
  async enviar(): Promise<void> {
    console.info('[whatsapp:dev] mensagem simulada (credenciais não configuradas)');
  }
}

/** Fake de testes: grava as mensagens ou falha sempre. */
export class WhatsAppFake implements WhatsAppGateway {
  enviadas: { para: string; texto: string }[] = [];
  falharSempre = false;

  async enviar(para: string, texto: string): Promise<void> {
    if (this.falharSempre) throw new Error('Número inválido');
    this.enviadas.push({ para, texto });
  }
}
