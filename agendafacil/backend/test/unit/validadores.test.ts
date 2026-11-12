import { cnpjCpfValido, normalizarCnpjCpf, E164_REGEX, SLUG_REGEX } from '../../src/domain/validadores';
import { somarMesesUTC } from '../../src/domain/datas';

describe('validadores', () => {
  it('valida CNPJ e CPF com dígitos verificadores', () => {
    expect(cnpjCpfValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjCpfValido('11222333000181')).toBe(true);
    expect(cnpjCpfValido('529.982.247-25')).toBe(true);
    expect(cnpjCpfValido('11.222.333/0001-80')).toBe(false);
    expect(cnpjCpfValido('111.111.111-11')).toBe(false);
    expect(cnpjCpfValido('123')).toBe(false);
  });

  it('normaliza para o formato com pontuação (unicidade ignora máscara)', () => {
    expect(normalizarCnpjCpf('11222333000181')).toBe('11.222.333/0001-81');
    expect(normalizarCnpjCpf('52998224725')).toBe('529.982.247-25');
  });

  it('valida slug (RN-10) e E.164 (RN-01)', () => {
    expect(SLUG_REGEX.test('barbearia-souza')).toBe(true);
    expect(SLUG_REGEX.test('Barbearia Souza')).toBe(false);
    expect(SLUG_REGEX.test('ab')).toBe(false);
    expect(E164_REGEX.test('+5582999990000')).toBe(true);
    expect(E164_REGEX.test('82999990000')).toBe(false);
  });

  it('soma meses limitando ao último dia do mês', () => {
    expect(somarMesesUTC(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(somarMesesUTC(new Date('2026-10-23T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-11-23');
  });
});
