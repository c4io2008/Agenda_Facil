import { execSync } from 'node:child_process';

/** Recria o schema do banco de testes a partir do schema.prisma. */
export default async function globalSetup() {
  const url =
    process.env.DATABASE_URL_TEST ?? 'postgresql://agendafacil:agendafacil@localhost:54329/agendafacil_test';
  execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
