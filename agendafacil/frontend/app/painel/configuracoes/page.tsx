
'use client';

import { useEffect, useState } from 'react';

import PainelShell from '@/components/PainelShell';

import { api, mensagemDeErro } from '@/lib/api';

import { aplicarTema, TEMAS, TEMA_PADRAO } from '@/lib/temas';

import './page.css';

interface Est {
  nome: string;
  slug: string;
  telefone: string | null;
  fusoHorario: string;
  intervaloGradeMinutos: number;
  catalogoPublico: boolean;
  tituloAgenda: string | null;
  logoUrl: string | null;
  tema: string;
  recursos: {
    catalogoPublico: boolean;
    logoPersonalizada: boolean;
  };
  horariosFuncionamento: {
    diaSemana: number;
    inicio: string;
    fim: string;
  }[];
}

const DIAS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export default function Configuracoes() {
  const [est, setEst] = useState<Est | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api<Est>('/estabelecimentos/me', { auth: 'contratante' })
      .then(setEst)
      .catch((e) => setErro(mensagemDeErro(e)));
  }, []);

  async function salvarDados(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    setMsg('');
    setErro('');

    try {
      const r = await api<Est & { slugAlterado: boolean }>(
        '/estabelecimentos/me',
        {
          method: 'PATCH',
          auth: 'contratante',
          body: {
            nome: f.get('nome'),
            slug: f.get('slug'),
            tituloAgenda: String(f.get('titulo') ?? '').trim() || null,
            ...(est?.recursos.logoPersonalizada
              ? {
                  logoUrl: String(f.get('logo') ?? '').trim() || null,
                }
              : {}),
            tema: String(f.get('tema') ?? 'lima'),
            intervaloGradeMinutos: Number(f.get('intervalo')),
            catalogoPublico: f.get('catalogo') === 'on',
          },
        }
      );

      setEst(r);

      setMsg(
        r.slugAlterado
          ? 'Salvo. Atenção: o link público antigo deixou de funcionar.'
          : 'Alterações salvas.'
      );
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  async function salvarHorarios(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const f = new FormData(e.currentTarget);

    setMsg('');
    setErro('');

    const horariosFuncionamento = DIAS.flatMap((_, d) =>
      f.get(`d${d}`) === 'on'
        ? [
            {
              diaSemana: d,
              inicio: String(f.get(`i${d}`)),
              fim: String(f.get(`f${d}`)),
            },
          ]
        : []
    );

    try {
      await api('/estabelecimentos/me/horarios-funcionamento', {
        method: 'PUT',
        auth: 'contratante',
        body: { horariosFuncionamento },
      });

      setMsg('Horários salvos.');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <PainelShell>
      <div className="painel-config">
        <h1 className="agenda-titulo">Configurações</h1>

        {msg && (
          <p className="ok" role="status">
            {msg}
          </p>
        )}

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}

        {est && (
          <>
            <form className="card" onSubmit={salvarDados}>
              <h2>Dados do negócio</h2>

              <label htmlFor="n">Nome</label>
              <input
                id="n"
                name="nome"
                defaultValue={est.nome}
                required
              />

              <label htmlFor="s">
                Endereço do link (/agendar/…)
              </label>
              <input
                id="s"
                name="slug"
                defaultValue={est.slug}
                required
                pattern="[a-z0-9\-]{3,60}"
              />

              <p>
                <small>
                  Mudar o endereço invalida o link que você já divulgou.
                </small>
              </p>

              <label htmlFor="t">
                Nome da agenda (título do painel e da página do cliente)
              </label>

              <input
                id="t"
                name="titulo"
                maxLength={60}
                placeholder="Ex: Agenda da Barbearia Souza"
                defaultValue={est.tituloAgenda ?? ''}
              />

              <label htmlFor="lg">Logo (URL da imagem)</label>

              <input
                id="lg"
                name="logo"
                type="url"
                maxLength={255}
                placeholder="https://…/logo.png"
                defaultValue={est.logoUrl ?? ''}
                disabled={!est.recursos.logoPersonalizada}
              />

              {!est.recursos.logoPersonalizada && (
                <p className="aviso">
                  A logo personalizada está disponível nos planos
                  Profissional e Premium.{' '}
                  <a href="/painel/assinatura">Fazer upgrade</a>
                </p>
              )}

              {est.logoUrl && (
                <p>
                  <img
                    src={est.logoUrl}
                    alt="Prévia da logo"
                    style={{ maxHeight: 64, maxWidth: '100%' }}
                  />
                </p>
              )}

              {/* Seletor de temas */}
              <fieldset className="temas">
                <legend>Tema do painel e da página do cliente</legend>

                <div className="temas-grade">
                  {TEMAS.map((t) => (
                    <label key={t.id} className="tema-opcao">
                      <input
                        type="radio"
                        name="tema"
                        value={t.id}
                        defaultChecked={
                          (est.tema ?? TEMA_PADRAO) === t.id
                        }
                        onChange={() => aplicarTema(t.id)}
                      />

                      <span
                        className="tema-previa"
                        style={{ background: t.cores[0] }}
                      >
                        <i style={{ background: t.cores[1] }} />
                        <i style={{ background: t.cores[2] }} />
                      </span>

                      <span className="tema-nome">{t.nome}</span>
                    </label>
                  ))}
                </div>

                <small>
                  Prévia na hora. Clique em Salvar para aplicar também na
                  página dos clientes.
                </small>
              </fieldset>

              <label htmlFor="iv">Intervalo da grade (min)</label>

              <input
                id="iv"
                name="intervalo"
                type="number"
                min={5}
                max={120}
                step={5}
                defaultValue={est.intervaloGradeMinutos}
              />

              <label>
                <input
                  type="checkbox"
                  name="catalogo"
                  defaultChecked={est.catalogoPublico}
                  disabled={!est.recursos.catalogoPublico}
                  style={{ width: 'auto' }}
                />{' '}
                Mostrar preços e fotos na página pública
              </label>

              {!est.recursos.catalogoPublico && (
                <p className="aviso">
                  O catálogo público está disponível apenas no plano Premium.{' '}
                  <a href="/painel/assinatura">Fazer upgrade</a>
                </p>
              )}

              <p>
                <button>Salvar</button>
              </p>
            </form>

            <form className="card" onSubmit={salvarHorarios}>
              <h2>Horário de funcionamento</h2>

              {DIAS.map((nome, d) => {
                const j = est.horariosFuncionamento.find(
                  (x) => x.diaSemana === d
                );

                return (
                  <div
                    key={nome}
                    className="linha"
                    style={{ marginBottom: 6 }}
                  >
                    <label style={{ margin: 0, minWidth: 110 }}>
                      <input
                        type="checkbox"
                        name={`d${d}`}
                        defaultChecked={!!j}
                        style={{ width: 'auto' }}
                      />{' '}
                      {nome}
                    </label>

                    <input
                      aria-label={`${nome}: abre`}
                      type="time"
                      name={`i${d}`}
                      defaultValue={j?.inicio ?? '09:00'}
                      style={{ width: 'auto' }}
                    />

                    <input
                      aria-label={`${nome}: fecha`}
                      type="time"
                      name={`f${d}`}
                      defaultValue={j?.fim ?? '18:00'}
                      style={{ width: 'auto' }}
                    />
                  </div>
                );
              })}

              <p>
                <button>Salvar horários</button>
              </p>
            </form>
          </>
        )}
      </div>
    </PainelShell>
  );
}
