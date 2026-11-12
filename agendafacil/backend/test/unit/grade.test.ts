import { calcularHorarios } from '../../src/domain/grade';

// 2026-10-15 é quinta-feira (diaSemana 4). Maceió = UTC-3 (sem horário de verão).
const base = {
  data: '2026-10-15',
  fuso: 'America/Maceio',
  intervaloMinutos: 30,
  funcionamento: [{ diaSemana: 4, inicio: '09:00', fim: '12:00' }],
  atendimento: [{ diaSemana: 4, inicio: '10:00', fim: '18:00' }],
  duracaoMinutos: 30,
  ocupados: [],
  agora: new Date('2026-10-01T00:00:00Z'),
};

describe('calcularHorarios', () => {
  it('usa a interseção entre funcionamento e atendimento', () => {
    expect(calcularHorarios(base)).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('respeita a duração do serviço no fim da janela', () => {
    expect(calcularHorarios({ ...base, duracaoMinutos: 60 })).toEqual(['10:00', '10:30', '11:00']);
  });

  it('remove horários que sobrepõem agendamentos CONFIRMADO', () => {
    const ocupados = [{ inicio: new Date('2026-10-15T13:30:00Z'), fim: new Date('2026-10-15T14:30:00Z') }]; // 10:30–11:30 local
    expect(calcularHorarios({ ...base, ocupados })).toEqual(['10:00', '11:30']);
  });

  it('descarta horários que já passaram', () => {
    const agora = new Date('2026-10-15T14:00:00Z'); // 11:00 local
    expect(calcularHorarios({ ...base, agora })).toEqual(['11:30']);
  });

  it('retorna vazio em dia sem funcionamento ou atendimento', () => {
    expect(calcularHorarios({ ...base, data: '2026-10-16' })).toEqual([]);
  });
});
