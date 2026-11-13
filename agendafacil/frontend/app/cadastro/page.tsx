'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import PasswordInput from '@/components/PasswordInput';
import { api, ApiError, mensagemDeErro } from '@/lib/api';
import '../auth.css';

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [erro, setErro] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  function formatarTelefone(valor: string) {
    let numeros = valor.replace(/\D/g, '');

    // Remove o código 55 se já estiver presente
    if (numeros.startsWith('55')) {
      numeros = numeros.slice(2);
    }

    // Limita a 11 dígitos (DDD + telefone)
    numeros = numeros.slice(0, 11);

    return `(+55) ${numeros}`;
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();

  const f = new FormData(e.currentTarget);

  // Converte o telefone para o formato E.164
  const telefoneDigitado = String(f.get('telefone') ?? '').replace(/\D/g, '');

  const telefoneFinal = telefoneDigitado
    ? telefoneDigitado.startsWith('55')
      ? `+${telefoneDigitado}`
      : `+55${telefoneDigitado}`
    : undefined;

  setEnviando(true);
  setErro('');
  setCampos({});

  try {
    await api('/estabelecimentos', {
      method: 'POST',
      body: {
        nome: f.get('nome'),
        slug: f.get('slug'),
        cnpjCpf: f.get('cnpjCpf'),
        email: f.get('email'),
        telefone: telefoneFinal,
        senha: f.get('senha'),
        plano: f.get('plano'),
      },
    });

    router.push('/login?cadastrado=1');
  } catch (err) {
    setErro(mensagemDeErro(err));

    if (err instanceof ApiError && err.details) {
      setCampos(
        Object.fromEntries(err.details.map((d) => [d.campo, d.mensagem]))
      );
    }
  } finally {
    setEnviando(false);
  }
}

  const campo = (
    nome: string,
    rotulo: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <>
      <label htmlFor={nome}>{rotulo}</label>
      <input
        id={nome}
        name={nome}
        required={nome !== 'telefone'}
        aria-invalid={!!campos[nome]}
        {...extra}
      />
      {campos[nome] && <span className="erro-campo">{campos[nome]}</span>}
    </>
  );

  return (
    <div className="auth">
      <h1>Crie sua conta</h1>
      <form
        onSubmit={enviar}
        className="auth-card"
      >
        {campo('nome', 'Nome do negócio', { placeholder: 'Cabeleleira Leila' })}
        {campo('slug', 'Endereço do seu link', {
          placeholder: '(agendafacil.com/agendar/nome-do-negocio)',
          pattern: '[a-z0-9\\-]{3,60}',
          title: 'Minúsculas, números e hífen',
        })}
        {campo('cnpjCpf', 'CNPJ ou CPF', {
          placeholder: 'CPF XXX.XXX.XXX-XX CNPJ XX.XXX.XXX/0001-XX',
        })}
        {campo('email', 'E-mail de acesso', {
          placeholder: 'email@exemplo.com.br',
          type: 'email',
        })}
        {campo('telefone', 'Contato da empresa (obrigatório)', {
          type: 'tel',
          defaultValue: '(+55) ',
          placeholder: '(+55) 82999990000',
          inputMode: 'numeric',
          onChange: (e) => {
            e.target.value = formatarTelefone(e.target.value);
          },
          onKeyDown: (e) => {
            if (
              e.currentTarget.selectionStart !== null &&
              e.currentTarget.selectionStart <= 6 &&
              ['Backspace', 'Delete'].includes(e.key)
            ) {
              e.preventDefault();
            }
          },
        })}
        <label htmlFor="senha">Senha (mínimo 8 caracteres)</label>
        <PasswordInput
          id="senha"
          name="senha"
          autoComplete="new-password"
          minLength={8}
        />
        {campos.senha && <span className="erro-campo">{campos.senha}</span>}
        <label htmlFor="plano">Plano</label>
        <select
          id="plano"
          name="plano"
          defaultValue={params.get('plano') ?? 'BASICO'}
        >
          <option value="BASICO">Básico - R$ 49,00/mês</option>
          <option value="PROFISSIONAL">Profissional - R$ 79,00/mês</option>
          <option value="PREMIUM">Premium - R$ 129,00/mês</option>
        </select>
        {erro && (
          <p
            className="erro"
            role="alert"
          >
            {erro}
          </p>
        )}
        <p className="auth-acao">
          <button
            className="auth-botao"
            disabled={enviando}
          >
            {enviando ? 'Criando…' : 'Criar conta'}
          </button>
        </p>
      </form>
      <p className="auth-rodape">
        Já possui uma conta? <Link href="/login">Entrar</Link>
      </p>
    </div>
  );
}

export default function Cadastro() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
