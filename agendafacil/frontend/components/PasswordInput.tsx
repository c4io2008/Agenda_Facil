'use client';
import { useState } from 'react';

interface Props {
  id: string;
  name: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}

/** Campo de senha com botão de olho: clicar alterna entre senha visível e oculta. */
export default function PasswordInput({ id, name, autoComplete, minLength, required = true }: Props) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="auth-senha">
      <input id={id} name={name} type={visivel ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required={required} />
      <button
        type="button"
        className="auth-olho"
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        onClick={() => setVisivel((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visivel && <path d="M3 3l18 18" />}
        </svg>
      </button>
    </div>
  );
}
