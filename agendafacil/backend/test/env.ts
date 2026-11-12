process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://agendafacil:agendafacil@localhost:54329/agendafacil_test';
process.env.JWT_SECRET = 'segredo-de-teste-com-mais-de-16-chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PAGAMENTOS_API_KEY = 'segredo-webhook-teste';
process.env.APP_PUBLIC_URL = 'http://localhost:3000';
