import { describe, expect, it } from 'vitest';
import { inscriptionKeyOf, sameContent } from '../../../src/domain/feed/FeedEvent';
import { charge, refund, voidOf } from '../../support/builders';

describe('Regra 5 (base): o que é "mesmo conteúdo"', () => {
  it('eventos com os mesmos campos são iguais', () => {
    expect(sameContent(refund(4, 'aurora', 'A', 500n, 'BRL'), refund(4, 'aurora', 'A', 500n, 'BRL'))).toBe(true);
    expect(sameContent(voidOf(11, 8), voidOf(11, 8))).toBe(true);
  });

  it.each([
    ['amount', charge(5, 'delta', 'E', 160_000n, 'BTC')],
    ['currency', charge(5, 'delta', 'E', 150_000n, 'ETH')],
    ['operator', charge(5, 'aurora', 'E', 150_000n, 'BTC')],
    ['reference', charge(5, 'delta', 'X', 150_000n, 'BTC')],
    ['kind', refund(5, 'delta', 'E', 150_000n, 'BTC')],
    ['tipo de evento', voidOf(5, 1)],
  ])('diferença em %s é conteúdo diferente', (_field, other) => {
    expect(sameContent(charge(5, 'delta', 'E', 150_000n, 'BTC'), other)).toBe(false);
  });

  it('anulações para alvos diferentes são conteúdos diferentes', () => {
    expect(sameContent(voidOf(11, 8), voidOf(11, 9))).toBe(false);
  });
});

describe('Identidade da inscrição', () => {
  it('é operador + reference: a mesma reference em outro operador é outra inscrição', () => {
    expect(inscriptionKeyOf({ operator: 'aurora', reference: 'A' })).not.toBe(
      inscriptionKeyOf({ operator: 'delta', reference: 'A' }),
    );
  });

  it('não colide quando os textos concatenados coincidem', () => {
    expect(inscriptionKeyOf({ operator: 'ab', reference: 'c' })).not.toBe(
      inscriptionKeyOf({ operator: 'a', reference: 'bc' }),
    );
  });
});
