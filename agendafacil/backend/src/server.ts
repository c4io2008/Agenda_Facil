import { criarApp } from './adapters/http/app';
import { carregarEnv } from './config';
import { criarContainer } from './infrastructure/container';
import { iniciarJobs } from './infrastructure/jobs/agendador';

const env = carregarEnv();
const container = criarContainer(env);
const app = criarApp(container);
const pararJobs = iniciarJobs(container);

const server = app.listen(env.PORT, () => {
  console.info(`AgendaFácil API ouvindo na porta ${env.PORT}`);
});

async function encerrar() {
  pararJobs();
  server.close(async () => {
    await container.prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
