const fs = require('fs');

const fs = require('fs');

const arquivos = [
  'app/painel/page.css',
  'app/painel/configuracoes/page.css',
  'app/painel/assinatura/page.css',
  'components/PainelShell.css',
];

const trocas = [
  // Cores principais
  ['#d6ff72', 'var(--t-destaque)'],
  ['#86e05a', 'var(--t-destaque-2)'],
  ['rgba(214, 255, 114, .10)', 'var(--t-destaque-fraco)'],

  // Fundo e textos
  ['background: #000;', 'background: var(--t-fundo);'],
  ['color: #000;', 'color: var(--t-btn-texto);'],
  ['color: #fff;', 'color: var(--t-texto);'],

  // Cards
  ['#292929', 'var(--t-card-a)'],
  ['#202020', 'var(--t-card-b)'],
  ['#222222', 'var(--t-card-b)'],

  // Inputs
  ['#c9d1db', 'var(--t-input)'],
  ['color: #111;', 'color: var(--t-input-texto);'],
  ['color: #222;', 'color: var(--t-input-texto);'],

  // Bordas e textos secundários
  ['#c4c4c4', 'var(--t-suave)'],
  ['#454545', 'var(--t-borda)'],

  // Mensagens
  ['#ff9b94', 'var(--t-erro)'],

  // Transparências
  ['rgba(255, 255, 255, .035)', 'var(--t-vidro)'],
  ['rgba(255, 255, 255, .03)', 'var(--t-vidro)'],
];

for (const f of arquivos) {
  if (!fs.existsSync(f)) {
    console.log('Arquivo não encontrado:', f);
    continue;
  }

  let s = fs.readFileSync(f, 'utf8');

  // Preserva o texto branco do selo vermelho de falha.
  s = s.replace(
    /(background: #8b3434;\s*)color: #fff;/g,
    '$1color: @@BRANCO@@;'
  );

  // Substitui as cores fixas pelas variáveis do tema.
  for (const [de, para] of trocas) {
    s = s.split(de).join(para);
  }

  // Restaura o branco do selo de falha.
  s = s.split('@@BRANCO@@').join('#fff');

  fs.writeFileSync(f, s);

  console.log('OK:', f);
}
