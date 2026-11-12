-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('BASICO', 'PROFISSIONAL', 'PREMIUM');

-- CreateEnum
CREATE TYPE "StatusEstabelecimento" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('CONFIRMADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ATIVA', 'EM_ATRASO', 'SUSPENSA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('PENDENTE', 'PAGA', 'FALHA');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('CONFIRMACAO', 'LEMBRETE', 'CANCELAMENTO');

-- CreateEnum
CREATE TYPE "StatusNotificacao" AS ENUM ('PENDENTE', 'ENVIADA', 'FALHA');

-- CreateEnum
CREATE TYPE "PapelPlataforma" AS ENUM ('ADMIN', 'SUPORTE');

-- CreateTable
CREATE TABLE "estabelecimentos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "cnpj_cpf" VARCHAR(18) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "telefone" VARCHAR(20),
    "senha_hash" VARCHAR(255) NOT NULL,
    "catalogo_publico" BOOLEAN NOT NULL DEFAULT false,
    "plano" "Plano" NOT NULL DEFAULT 'BASICO',
    "status" "StatusEstabelecimento" NOT NULL DEFAULT 'ATIVO',
    "fuso_horario" VARCHAR(50) NOT NULL DEFAULT 'America/Maceio',
    "intervalo_grade_minutos" INTEGER NOT NULL DEFAULT 30,
    "titulo_agenda" VARCHAR(60),
    "logo_url" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estabelecimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_funcionamento" (
    "id" UUID NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "abre" VARCHAR(5) NOT NULL,
    "fecha" VARCHAR(5) NOT NULL,

    CONSTRAINT "horarios_funcionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" UUID NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_atendimento" (
    "id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "inicio" VARCHAR(5) NOT NULL,
    "fim" VARCHAR(5) NOT NULL,

    CONSTRAINT "horarios_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" UUID NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "preco" DECIMAL(8,2) NOT NULL,
    "duracao_minutos" INTEGER NOT NULL,
    "foto_url" VARCHAR(255),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais_servicos" (
    "profissional_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,

    CONSTRAINT "profissionais_servicos_pkey" PRIMARY KEY ("profissional_id","servico_id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" UUID NOT NULL,
    "codigo" VARCHAR(12) NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "profissional_id" UUID NOT NULL,
    "servico_id" UUID NOT NULL,
    "nome_cliente" VARCHAR(150) NOT NULL,
    "whatsapp_cliente" VARCHAR(20) NOT NULL,
    "data_hora" TIMESTAMPTZ NOT NULL,
    "status" "StatusAgendamento" NOT NULL DEFAULT 'CONFIRMADO',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" UUID NOT NULL,
    "estabelecimento_id" UUID NOT NULL,
    "plano" "Plano" NOT NULL,
    "valor_mensal" DECIMAL(8,2) NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'ATIVA',
    "plano_agendado" "Plano",
    "cancelar_no_fim_do_ciclo" BOOLEAN NOT NULL DEFAULT false,
    "inicio" DATE NOT NULL,
    "proxima_cobranca" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" UUID NOT NULL,
    "assinatura_id" UUID NOT NULL,
    "valor" DECIMAL(8,2) NOT NULL,
    "vencimento" DATE NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "pago_em" TIMESTAMPTZ,
    "referencia_externa" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes_whatsapp" (
    "id" UUID NOT NULL,
    "agendamento_id" UUID NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "status" "StatusNotificacao" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimo_erro" VARCHAR(255),
    "agendada_para" TIMESTAMPTZ NOT NULL,
    "enviada_em" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_plataforma" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "papel" "PapelPlataforma" NOT NULL DEFAULT 'SUPORTE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_plataforma" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "acao" VARCHAR(60) NOT NULL,
    "estabelecimento_id" UUID,
    "detalhe" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_slug_key" ON "estabelecimentos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_cnpj_cpf_key" ON "estabelecimentos"("cnpj_cpf");

-- CreateIndex
CREATE UNIQUE INDEX "estabelecimentos_email_key" ON "estabelecimentos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_codigo_key" ON "agendamentos"("codigo");

-- CreateIndex
CREATE INDEX "idx_agendamentos_profissional_data" ON "agendamentos"("profissional_id", "data_hora");

-- CreateIndex
CREATE INDEX "idx_agendamentos_estab_data" ON "agendamentos"("estabelecimento_id", "data_hora");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_estabelecimento_id_key" ON "assinaturas"("estabelecimento_id");

-- CreateIndex
CREATE INDEX "notificacoes_whatsapp_status_agendada_para_idx" ON "notificacoes_whatsapp"("status", "agendada_para");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_plataforma_email_key" ON "usuarios_plataforma"("email");

-- AddForeignKey
ALTER TABLE "horarios_funcionamento" ADD CONSTRAINT "horarios_funcionamento_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_atendimento" ADD CONSTRAINT "horarios_atendimento_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais_servicos" ADD CONSTRAINT "profissionais_servicos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_servico_id_fkey" FOREIGN KEY ("servico_id") REFERENCES "servicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_estabelecimento_id_fkey" FOREIGN KEY ("estabelecimento_id") REFERENCES "estabelecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_assinatura_id_fkey" FOREIGN KEY ("assinatura_id") REFERENCES "assinaturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes_whatsapp" ADD CONSTRAINT "notificacoes_whatsapp_agendamento_id_fkey" FOREIGN KEY ("agendamento_id") REFERENCES "agendamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
