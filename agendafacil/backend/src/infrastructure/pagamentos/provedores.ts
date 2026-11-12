import { randomUUID } from 'node:crypto';
import type { ProvedorPagamento, ResultadoCobranca } from '../../application/ports';
import type { StatusCobranca } from '../../domain/entidades';

/** Provedor `fake` (dev/teste). O gateway real ainda é uma decisão em aberto (SPECIFICATION §6.3). */
export class ProvedorPagamentoFake implements ProvedorPagamento {
  statusInicial: StatusCobranca = 'PENDENTE';

  async cobrar(): Promise<ResultadoCobranca> {
    return { referenciaExterna: `fake_${randomUUID()}`, status: this.statusInicial };
  }
}
