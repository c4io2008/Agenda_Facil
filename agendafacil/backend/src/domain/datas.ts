/** Utilitários de data em UTC (colunas DATE do banco). */
export function inicioDoDiaUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function somarDiasUTC(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * 86_400_000);
}

/** Soma meses preservando o dia, limitando ao último dia do mês de destino. */
export function somarMesesUTC(d: Date, meses: number): Date {
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d.getUTCDate(), ultimo));
  return alvo;
}

export function diasEntre(a: Date, b: Date): number {
  return Math.floor((inicioDoDiaUTC(b).getTime() - inicioDoDiaUTC(a).getTime()) / 86_400_000);
}

export function paraDataISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
