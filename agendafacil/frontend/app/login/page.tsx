'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import PasswordInput from '@/components/PasswordInput';
import { api, mensagemDeErro, tokens } from '@/lib/api';
import '../auth.css';

function Form() {
  const router = useRouter();
  const cadastrado = useSearchParams().get('cadastrado');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErro('');
    try {
      const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: { email: f.get('email'), senha: f.get('senha') } });
      tokens.gravar('contratante', r.token);
      router.push('/painel');
    } catch (err) { setErro(mensagemDeErro(err)); }
  }

  return (
    <div className="auth auth-login">
      <h1>Entrar</h1>
      {cadastrado && <p className="ok">Conta criada. Entre para configurar seu negócio.</p>}
      <form onSubmit={entrar} className="auth-card">
        <label htmlFor="email">E-mail </label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="senha">Senha</label>
        <PasswordInput id="senha" name="senha" autoComplete="current-password" />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <p className="auth-acao"><button className="auth-botao">Entrar</button></p>
      </form>
      <p className="auth-rodape">Novo por aqui? <Link href="/cadastro">Criar conta</Link></p>
    </div>
  );
}

export default function Login() {
  return <Suspense><Form /></Suspense>;
}
