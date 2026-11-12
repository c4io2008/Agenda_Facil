import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Uso: SEED_ADMIN_EMAIL=voce@agendafacil.com SEED_ADMIN_SENHA='senha-forte' npm run seed:plataforma
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_SENHA;
  if (!email || !senha || senha.length < 8) throw new Error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_SENHA (mín. 8 caracteres).');
  const prisma = new PrismaClient();
  await prisma.usuarioPlataforma.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: { nome: 'Administrador', email: email.toLowerCase(), senhaHash: await bcrypt.hash(senha, 10), papel: 'ADMIN' },
  });
  await prisma.$disconnect();
  console.info('Usuário ADMIN da plataforma criado.');
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
