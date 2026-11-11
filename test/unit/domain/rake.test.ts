import { describe, expect, it } from 'vitest';
import { InvalidBasisPointsError, splitRake } from '../../../src/domain/rake/RakeSplit';

describe('Regra 2: divisão do rake sobre o líquido', () => {
  it('motor fica com floor(líquido × bps / 10000)', () => {
    expect(splitRake(1_499_999n, 1500)).toEqual({ net: 1_499_999n, engine: 224_999n, operator: 1_275_000n });
  });

  it('operador fica com o resto, sem perder unidade', () => {
    expect(splitRake(400n, 2000)).toEqual({ net: 400n, engine: 80n, operator: 320n });
    expect(splitRake(7n, 1500)).toEqual({ net: 7n, engine: 1n, operator: 6n });
  });

  it('líquido zero termina em zero para os dois lados', () => {
    expect(splitRake(0n, 1500)).toEqual({ net: 0n, engine: 0n, operator: 0n });
  });

  it('funciona acima de 64 bits', () => {
    const net = 20n * 10n ** 18n;
    expect(splitRake(net, 1000)).toEqual({ net, engine: 2n * 10n ** 18n, operator: 18n * 10n ** 18n });
  });

  it('engine + operator === net para qualquer valor', () => {
    for (const net of [1n, 3n, 9_999n, 10_001n, 123_456_789_012_345_678_901n]) {
      for (const bps of [0, 1, 1500, 3333, 9999, 10_000]) {
        const split = splitRake(net, bps);
        expect(split.engine + split.operator).toBe(net);
        expect(split.engine >= 0n && split.operator >= 0n).toBe(true);
      }
    }
  });

  it('nos extremos, 0 bps é tudo do operador e 10000 bps é tudo do motor', () => {
    expect(splitRake(500n, 0)).toEqual({ net: 500n, engine: 0n, operator: 500n });
    expect(splitRake(500n, 10_000)).toEqual({ net: 500n, engine: 500n, operator: 0n });
  });

  it.each([-1, 10_001, 15.5, Number.NaN])('rejeita bps inválido (%s)', (bps) => {
    expect(() => splitRake(100n, bps)).toThrow(InvalidBasisPointsError);
  });

  it('rejeita líquido negativo (seria um bug de quem chama)', () => {
    expect(() => splitRake(-1n, 1500)).toThrow(RangeError);
  });
});
