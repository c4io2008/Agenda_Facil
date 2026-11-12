import { DateTime } from 'luxon';
import type { Config, NotificacaoDevida, Relogio, UnitOfWork, WhatsAppGateway } from '../ports';

export function montarMensagem(n: NotificacaoDevida, appPublicUrl: string): string {
  const dt = DateTime.fromJSDate(n.dataHora, { zone: n.fuso }).setLocale('pt-BR');
  const quando = `${dt.toFormat('dd/MM/yyyy')} às ${dt.toFormat('HH:mm')}`;
  const link = `${appPublicUrl}/cancelar/${n.codigo}`;
  const detalhes = `Serviço: ${n.servicoNome}\nProfissional: ${n.profissionalNome}\nCódigo: ${n.codigo}`;
  switch (n.tipo) {
    case 'CONFIRMACAO':
      return `${n.nomeEstabelecimento}: agendamento confirmado para ${quando}.\n${detalhes}\nPara cancelar: ${link}`;
    case 'LEMBRETE':
      return `Lembrete de ${n.nomeEstabelecimento}: seu horário é ${quando}.\n${detalhes}\nPara cancelar: ${link}`;
    case 'CANCELAMENTO':
      return `${n.nomeEstabelecimento}: seu agendamento de ${quando} foi cancelado.\n${detalhes}`;
  }
}

export class EnviarNotificacoesUseCase {
  constructor(
    private uow: UnitOfWork,
    private whatsapp: WhatsAppGateway,
    private relogio: Relogio,
    private config: Config,
  ) {}

  /** Chamado pelo job a cada minuto. Falha de envio nunca toca no agendamento (RNF08). */
  async executar(): Promise<{ enviadas: number; falhas: number }> {
    const { notificacoes } = this.uow.repos;
    const agora = this.relogio.agora();
    const devidas = await notificacoes.listarDevidas(agora, 100);
    let enviadas = 0;
    let falhas = 0;

    for (const n of devidas) {
      try {
        await this.whatsapp.enviar(n.whatsappCliente, montarMensagem(n, this.config.appPublicUrl));
        await notificacoes.marcarEnviada(n.id, agora);
        enviadas++;
      } catch (e) {
        const tentativas = n.tentativas + 1;
        const esgotou = tentativas >= this.config.maxTentativasWhatsapp;
        // Mensagem técnica apenas: nunca registrar nome/telefone do cliente.
        const erro = (e instanceof Error ? e.message : 'Erro desconhecido').slice(0, 255);
        await notificacoes.registrarResultadoFalha(n.id, {
          tentativas,
          erro,
          status: esgotou ? 'FALHA' : 'PENDENTE',
          agendadaPara: esgotou ? n.agendadaPara : new Date(agora.getTime() + this.config.whatsappRetryMinutos * 60_000),
        });
        falhas++;
      }
    }
    return { enviadas, falhas };
  }
}
