import { describe, expect, it } from 'vitest';
import { CURRENCIES } from '../../../src/domain/money/Currency';
import { DecimalPrice, InvalidPriceError } from '../../../src/domain/money/DecimalPrice';
import { InvalidAmountError, parseMinorUnits } from '../../../src/domain/money/MinorUnits';
import { toBrlCents } from '../../../src/domain/money/conversion';

describe('Regra 1: dinheiro é inteiro na menor unidade', () => {
  describe('parseMinorUnits', () => {
    it('lê um inteiro positivo como bigint', () => {
      expect(parseMinorUnits('500')).toBe(500n);
    });

    it('não perde precisão acima de 64 bits (25 ETH em wei)', () => {
      const wei = parseMinorUnits('25000000000000000000');
      expect(wei).toBe(25n * 10n ** 18n);
      expect(wei > 2n ** 64n - 1n).toBe(true);
    });

    it('não perde precisão acima de 2^53, onde number já erraria', () => {
      expect(parseMinorUnits('9007199254740993')).toBe(9007199254740993n);
    });

    it.each(['0', '-1', '1.5', '1e3', '', ' 1', '1 ', '+1', '0500', 'abc', '0x10', '１'])(
      'rejeita "%s" (não é inteiro positivo canônico)',
      (raw) => {
        expect(() => parseMinorUnits(raw)).toThrow(InvalidAmountError);
      },
    );
  });

  describe('DecimalPrice', () => {
    it('guarda o preço como inteiro e escala, sem float', () => {
      const price = DecimalPrice.parse('5.40');
      expect(price.mantissa).toBe(540n);
      expect(price.scale).toBe(2);
    });

    it('aceita preço inteiro, sem parte decimal', () => {
      const price = DecimalPrice.parse('20000');
      expect(price.mantissa).toBe(20000n);
      expect(price.scale).toBe(0);
    });

    it('preserva o texto original na serialização', () => {
      expect(DecimalPrice.parse('350000.00').toString()).toBe('350000.00');
      expect(DecimalPrice.parse('5.35').toString()).toBe('5.35');
    });

    it.each(['0', '0.00', '-5.40', '5,40', 'abc', '', '.5', '5.', '1e3'])('rejeita "%s"', (raw) => {
      expect(() => DecimalPrice.parse(raw)).toThrow(InvalidPriceError);
    });
  });

  describe('toBrlCents (conversão com floor único no final)', () => {
    it('USDT: 1,499999 × 5,40 = R$ 8,0999946 → 809 centavos', () => {
      expect(toBrlCents(1_499_999n, CURRENCIES.USDT, DecimalPrice.parse('5.40'))).toBe(809n);
    });

    it('USDT: 0,224999 × 5,40 = R$ 1,2149946 → 121 centavos', () => {
      expect(toBrlCents(224_999n, CURRENCIES.USDT, DecimalPrice.parse('5.40'))).toBe(121n);
    });

    it('ETH: 3 ETH × 19000 = R$ 57.000,00', () => {
      expect(toBrlCents(3n * 10n ** 18n, CURRENCIES.ETH, DecimalPrice.parse('19000.00'))).toBe(5_700_000n);
    });

    it('BTC: 100000 satoshis × 350000 = R$ 350,00', () => {
      expect(toBrlCents(100_000n, CURRENCIES.BTC, DecimalPrice.parse('350000.00'))).toBe(35_000n);
    });

    it('BRL com preço 1 é identidade', () => {
      expect(toBrlCents(400n, CURRENCIES.BRL, DecimalPrice.one())).toBe(400n);
    });

    it('arredonda para baixo, nunca para cima', () => {
      // 1 wei × 20000 = R$ 0,00000000000002
      expect(toBrlCents(1n, CURRENCIES.ETH, DecimalPrice.parse('20000.00'))).toBe(0n);
      // 1851 micro-USDT × 5,40 = 0,99954 centavo; 1852 micro-USDT = 1,00008 centavo
      expect(toBrlCents(1_851n, CURRENCIES.USDT, DecimalPrice.parse('5.40'))).toBe(0n);
      expect(toBrlCents(1_852n, CURRENCIES.USDT, DecimalPrice.parse('5.40'))).toBe(1n);
    });

    it('zero continua zero', () => {
      expect(toBrlCents(0n, CURRENCIES.BTC, DecimalPrice.parse('350000.00'))).toBe(0n);
    });
  });
});
