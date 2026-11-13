-- Add configurable cancellation notice to each establishment.
ALTER TABLE "estabelecimentos" ADD COLUMN "mensagem_cancelamento" VARCHAR(500);
