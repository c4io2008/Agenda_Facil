import { PrismaClient } from '@prisma/client';

let instancia: PrismaClient | undefined;

export function obterPrisma(): PrismaClient {
  instancia ??= new PrismaClient();
  return instancia;
}
