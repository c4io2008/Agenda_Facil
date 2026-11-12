import { DateTime } from 'luxon';
import type { JanelaHorario } from './entidades';

export interface Ocupacao {
  inicio: Date;
  fim: Date;
}

export interface EntradaGrade {
  /** YYYY-MM-DD no fuso do Contratante. */
  data: string;
  fuso: string;
  intervaloMinutos: number;
  funcionamento: JanelaHorario[];
  atendimento: JanelaHorario[];
  duracaoMinutos: number;
  ocupados: Ocupacao[];
  agora: Date;
}

export interface Slot {
  /** "HH:mm" no fuso do Contratante. */
  local: string;
  inicio: Date;
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Interseção entre funcionamento do Contratante e atendimento do profissional,
 * menos agendamentos CONFIRMADO, considerando a duração do serviço e descartando o passado.
 */
export function calcularSlots(e: EntradaGrade): Slot[] {
  const dia = DateTime.fromISO(e.data, { zone: e.fuso });
  if (!dia.isValid) return [];
  const dow = dia.weekday % 7; // luxon: 1=seg..7=dom → 0=dom
  const fun = e.funcionamento.filter((j) => j.diaSemana === dow);
  const atd = e.atendimento.filter((j) => j.diaSemana === dow);
  const slots = new Map<number, Slot>();

  for (const f of fun) {
    for (const a of atd) {
      const ini = Math.max(minutos(f.inicio), minutos(a.inicio));
      const fim = Math.min(minutos(f.fim), minutos(a.fim));
      for (let m = ini; m + e.duracaoMinutos <= fim; m += e.intervaloMinutos) {
        const inicio = dia.set({ hour: Math.floor(m / 60), minute: m % 60, second: 0, millisecond: 0 });
        const ini_ = inicio.toJSDate();
        if (ini_.getTime() <= e.agora.getTime()) continue;
        const fim_ = new Date(ini_.getTime() + e.duracaoMinutos * 60_000);
        const conflita = e.ocupados.some((o) => ini_ < o.fim && fim_ > o.inicio);
        if (conflita) continue;
        slots.set(ini_.getTime(), { local: inicio.toFormat('HH:mm'), inicio: ini_ });
      }
    }
  }
  return [...slots.values()].sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
}

export const calcularHorarios = (e: EntradaGrade): string[] => calcularSlots(e).map((s) => s.local);

/** Data (YYYY-MM-DD) de um instante no fuso do Contratante. */
export function dataLocal(instante: Date, fuso: string): string {
  return DateTime.fromJSDate(instante, { zone: fuso }).toFormat('yyyy-MM-dd');
}

/** Limites UTC do dia local (ou de um intervalo de dias locais). */
export function limitesUTC(inicio: string, fim: string, fuso: string): { de: Date; ate: Date } {
  const de = DateTime.fromISO(inicio, { zone: fuso }).startOf('day').toJSDate();
  const ate = DateTime.fromISO(fim, { zone: fuso }).endOf('day').toJSDate();
  return { de, ate };
}
