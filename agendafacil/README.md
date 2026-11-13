# AgendaFácil

SaaS multi-tenant de agendamento (Express + Prisma + Next.js). Fonte da verdade: `SPECIFICATION.md`.

## Rodar local
```bash
cp .env.example .env              # na raiz: o compose exige JWT_SECRET
docker compose up -d db                 # Postgres (cria também agendafacil_test)
cd backend && cp .env.example .env && npm install
npx prisma generate
npx prisma migrate dev --name init      # cria a migration inicial
SEED_ADMIN_EMAIL=voce@agendafacil.com SEED_ADMIN_SENHA='senha-forte' npm run seed:plataforma 
npx cross-env SEED_ADMIN_EMAIL=voce@agendafacil.com SEED_ADMIN_SENHA=senha-forte npm run seed:plataforma  
$env:SEED_ADMIN_EMAIL="voce@agendafacil.com"; $env:SEED_ADMIN_SENHA="senha-forte"; npm run seed:plataforma
npm run dev                             # API em :3333
cd ../frontend && cp .env.example .env.local && npm install && npm run dev   # :3000
```

## Testes
```bash
cd backend && npm run test:unit   # domínio, sem banco
cd backend && npm run test        # 14 critérios de aceite + bordas (precisa do Postgres de teste)
cd frontend && npm run test:frontend
```

## Decisões / desvios da spec
- Horários (`abre/fecha/inicio/fim`) guardados como `"HH:mm"` (VarChar) em vez de `TIME`.
- Extras: coluna `assinaturas.cancelar_no_fim_do_ciclo` (RN-17), tabela `auditoria_plataforma` (RF14).
- Respostas aditivas: página pública inclui `id`, `fusoHorario` e `profissionais` (o front precisa deles).
- Personalização: `titulo_agenda` e `logo_url` (logo só em Profissional/Premium, por URL; sem upload).
- `POST /webhooks/pagamentos` (header `x-webhook-secret` = `PAGAMENTOS_API_KEY`) registra pagamento; gateway real segue em aberto (provedor `fake`).
- Token JWT do painel fica em `localStorage` (simples); em produção prefira cookie httpOnly.
