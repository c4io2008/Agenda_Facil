import { POLITICA_PLANOS, type Plano } from '../../domain/politica-planos';
import { EstabelecimentoJaCadastradoError, ValidacaoDominioError } from '../../domain/errors';
import { cnpjCpfValido, normalizarCnpjCpf } from '../../domain/validadores';
import { inicioDoDiaUTC, paraDataISO, somarMesesUTC } from '../../domain/datas';
import type { HasherSenha, Relogio, UnitOfWork } from '../ports';

export interface EntradaCadastro {
  nome: string;
  slug: string;
  cnpjCpf: string;
  email: string;
  telefone?: string | null;
  senha: string;
  plano: Plano;
}

export class CadastrarEstabelecimentoUseCase {
  constructor(private uow: UnitOfWork, private hasher: HasherSenha, private relogio: Relogio) {}

  async executar(entrada: EntradaCadastro) {
    if (!cnpjCpfValido(entrada.cnpjCpf)) {
      throw new ValidacaoDominioError('CNPJ/CPF inválido', [{ campo: 'cnpjCpf', mensagem: 'CNPJ/CPF inválido' }]);
    }
    const dados = {
      nome: entrada.nome.trim(),
      slug: entrada.slug,
      cnpjCpf: normalizarCnpjCpf(entrada.cnpjCpf),
      email: entrada.email.trim().toLowerCase(),
      telefone: entrada.telefone ?? null,
      plano: entrada.plano,
    };
    const { estabelecimentos } = this.uow.repos;
    if (await estabelecimentos.existeConflito(dados)) throw new EstabelecimentoJaCadastradoError();

    const senhaHash = await this.hasher.gerar(entrada.senha);
    const inicio = inicioDoDiaUTC(this.relogio.agora());
    const proximaCobranca = somarMesesUTC(inicio, 1);
    const valorMensal = POLITICA_PLANOS[dados.plano].preco;

    const est = await estabelecimentos.criarComAssinatura(
      { ...dados, senhaHash },
      { plano: dados.plano, valorMensal, inicio, proximaCobranca },
    );

    return {
      id: est.id,
      slug: est.slug,
      plano: est.plano,
      status: est.status,
      assinatura: { status: 'ATIVA' as const, valorMensal, proximaCobranca: paraDataISO(proximaCobranca) },
    };
  }
}
