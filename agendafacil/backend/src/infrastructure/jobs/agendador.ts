import cron from 'node-cron';
import type { Container } from '../container';

function protegido(nome: string, fn: () => Promise<unknown>) {
  let rodando = false;
  return async () => {
    if (rodando) return; // evita execuções sobrepostas
    rodando = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[job:${nome}] falhou:`, e instanceof Error ? e.message : 'erro desconhecido');
    } finally {
      rodando = false;
    }
  };
}

/** Jobs no processo do backend (v1): envio de WhatsApp a cada minuto e cobrança diária. */
export function iniciarJobs(c: Container) {
  const tarefas = [
    cron.schedule('* * * * *', protegido('whatsapp', () => c.useCases.enviarNotificacoes.executar())),
    cron.schedule('0 3 * * *', protegido('cobrancas', () => c.useCases.processarCobrancas.executar())),
  ];
  return () => tarefas.forEach((t) => t.stop());
}
