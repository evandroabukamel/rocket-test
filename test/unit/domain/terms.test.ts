import { describe, expect, it } from 'vitest';
import { DecimalPrice } from '../../../src/domain/money/DecimalPrice';
import { DuplicateScheduleEntryError, EffectiveSchedule } from '../../../src/domain/terms/EffectiveSchedule';
import { MissingContractError, MissingPriceError, TermsCatalog } from '../../../src/domain/terms/TermsCatalog';
import { charge, sampleTerms } from '../../support/builders';

describe('EffectiveSchedule: vale o maior from_id <= id', () => {
  const schedule = () =>
    new EffectiveSchedule([
      { fromId: 8, value: 'b' },
      { fromId: 1, value: 'a' },
      { fromId: 20, value: 'c' },
    ]);

  it('escolhe a linha vigente, com as linhas fora de ordem', () => {
    expect(schedule().valueAt(1)).toBe('a');
    expect(schedule().valueAt(7)).toBe('a');
    expect(schedule().valueAt(19)).toBe('b');
    expect(schedule().valueAt(1_000)).toBe('c');
  });

  it('o próprio from_id já vale (limite inclusivo)', () => {
    expect(schedule().valueAt(8)).toBe('b');
    expect(schedule().valueAt(20)).toBe('c');
  });

  it('antes da primeira linha não há valor', () => {
    expect(new EffectiveSchedule([{ fromId: 5, value: 'x' }]).valueAt(4)).toBeUndefined();
    expect(new EffectiveSchedule<string>([]).valueAt(1)).toBeUndefined();
  });

  it('from_id repetido é configuração ambígua', () => {
    expect(
      () =>
        new EffectiveSchedule([
          { fromId: 1, value: 'a' },
          { fromId: 1, value: 'b' },
        ]),
    ).toThrow(DuplicateScheduleEntryError);
  });
});

describe('TermsCatalog: termos da cobrança', () => {
  it('contrato muda com o tempo (delta: 1000 bps até o id 7, 2000 a partir do 8)', () => {
    const terms = sampleTerms();
    expect(terms.termsFor(charge(7, 'delta', 'X', 100n, 'BRL')).bps).toBe(1000);
    expect(terms.termsFor(charge(8, 'delta', 'X', 100n, 'BRL')).bps).toBe(2000);
  });

  it('cotação muda com o tempo (USDT: 5.40 até o id 8, 5.35 a partir do 9)', () => {
    const terms = sampleTerms();
    expect(String(terms.termsFor(charge(8, 'aurora', 'X', 1n, 'USDT')).price)).toBe('5.40');
    expect(String(terms.termsFor(charge(9, 'aurora', 'X', 1n, 'USDT')).price)).toBe('5.35');
  });

  it('BRL não precisa de linha de cotação: o preço é 1', () => {
    const price = sampleTerms().termsFor(charge(1, 'aurora', 'X', 1n, 'BRL')).price;
    expect(price?.mantissa).toBe(1n);
    expect(price?.scale).toBe(0);
  });

  it('FUN não tem cotação: nunca é convertida', () => {
    expect(sampleTerms().termsFor(charge(6, 'delta', 'H', 1000n, 'FUN')).price).toBeNull();
  });

  it('operador sem contrato vigente é erro explícito', () => {
    expect(() => sampleTerms().termsFor(charge(1, 'zeta', 'X', 1n, 'BRL'))).toThrow(MissingContractError);
  });

  it('cripto sem cotação vigente é erro explícito', () => {
    const terms = new TermsCatalog(
      [{ operator: 'aurora', fromId: 1, engineBps: 1500 }],
      [{ currency: 'ETH', fromId: 10, brl: DecimalPrice.parse('20000.00') }],
    );
    expect(() => terms.termsFor(charge(9, 'aurora', 'X', 1n, 'ETH'))).toThrow(MissingPriceError);
    expect(() => terms.termsFor(charge(1, 'aurora', 'X', 1n, 'BTC'))).toThrow(MissingPriceError);
  });
});
