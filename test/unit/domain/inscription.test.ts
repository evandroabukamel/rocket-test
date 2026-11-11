import { describe, expect, it } from 'vitest';
import { evaluateInscription } from '../../../src/domain/ledger/Inscription';
import { ETH, charge, refund, sampleTerms } from '../../support/builders';

const evaluate = (charges: Parameters<typeof evaluateInscription>[0]['charges'], refunds: Parameters<typeof evaluateInscription>[0]['refunds']) =>
  evaluateInscription({ charges, refunds }, sampleTerms());

describe('Inscrição: líquido, rake e reais calculados uma vez por inscrição', () => {
  it('regra 2: líquido = cobrado − estornado, rake sobre o líquido', () => {
    const outcome = evaluate([charge(2, 'aurora', 'B', 2_500_000n, 'USDT')], [refund(9, 'aurora', 'B', 1_000_001n, 'USDT')]);
    expect(outcome.split).toEqual({ net: 1_499_999n, engine: 224_999n, operator: 1_275_000n });
    expect(outcome.applied).toEqual([{ eventId: 9, amount: 1_000_001n }]);
  });

  it('regra 2: devolução integral termina em zero para os dois lados, inclusive em reais', () => {
    const outcome = evaluate([charge(1, 'aurora', 'A', 500n, 'BRL')], [refund(4, 'aurora', 'A', 500n, 'BRL')]);
    expect(outcome.split).toEqual({ net: 0n, engine: 0n, operator: 0n });
    expect(outcome.brlCents).toEqual({ net: 0n, engine: 0n, operator: 0n });
  });

  it('regra 2: não arredonda evento a evento (o bug dos centavos sobrando)', () => {
    // Por evento: floor(7×15%)=1, floor(3×15%)=0, floor(4×15%)=0 → sobraria 1 centavo para o motor.
    const outcome = evaluate(
      [charge(1, 'aurora', 'R', 7n, 'BRL')],
      [refund(2, 'aurora', 'R', 3n, 'BRL'), refund(3, 'aurora', 'R', 4n, 'BRL')],
    );
    expect(outcome.split).toEqual({ net: 0n, engine: 0n, operator: 0n });
  });

  it('regra 3: o bps fica preso ao da cobrança, mesmo com estorno depois da mudança de contrato', () => {
    // delta: 1000 bps até o id 7, 2000 a partir do 8. Cobrança no id 3, estorno no id 15.
    const outcome = evaluate([charge(3, 'delta', 'C', 25n * ETH, 'ETH')], [refund(15, 'delta', 'C', 5n * ETH, 'ETH')]);
    expect(outcome.terms?.bps).toBe(1000);
    expect(outcome.split).toEqual({ net: 20n * ETH, engine: 2n * ETH, operator: 18n * ETH });
  });

  it('regra 3: a cotação fica presa à da cobrança, mesmo com estorno depois da mudança', () => {
    // USDT: 5.40 até o id 8, 5.35 a partir do 9. Estorno no id 9 continua usando 5.40.
    const outcome = evaluate([charge(2, 'aurora', 'B', 2_500_000n, 'USDT')], [refund(9, 'aurora', 'B', 1_000_001n, 'USDT')]);
    expect(String(outcome.terms?.price)).toBe('5.40');
    expect(outcome.brlCents?.net).toBe(809n);
  });

  it('regra 4: reais por inscrição — líquido e motor convertidos com floor, operador é a diferença', () => {
    const outcome = evaluate([charge(2, 'aurora', 'B', 2_500_000n, 'USDT')], [refund(9, 'aurora', 'B', 1_000_001n, 'USDT')]);
    // líquido R$ 8,0999946 → 809; motor R$ 1,2149946 → 121; operador 809 − 121 = 688
    expect(outcome.brlCents).toEqual({ net: 809n, engine: 121n, operator: 688n });
  });

  it('regra 4: o operador em reais é a diferença, não a própria conversão', () => {
    // 20 satoshis a R$ 350.000/BTC: 1 sat = 0,35 centavo. Motor 15% = 3 sat.
    // líquido 7,00 → 7; motor 1,05 → 1; operador = 7 − 1 = 6 (converter direto daria floor(5,95) = 5
    // e um centavo sumiria).
    const outcome = evaluate([charge(1, 'aurora', 'Q', 20n, 'BTC')], []);
    expect(outcome.split).toEqual({ net: 20n, engine: 3n, operator: 17n });
    expect(outcome.brlCents).toEqual({ net: 7n, engine: 1n, operator: 6n });
  });

  it('regra 4: FUN tem rake na menor unidade, mas nunca valor em reais', () => {
    const outcome = evaluate([charge(6, 'delta', 'H', 1000n, 'FUN')], []);
    expect(outcome.split).toEqual({ net: 1000n, engine: 100n, operator: 900n });
    expect(outcome.brlCents).toBeNull();
  });

  it('regra 6: estorno que passa do cobrado é aplicado em parte e o resto vira excesso', () => {
    const outcome = evaluate([charge(8, 'aurora', 'D', 200n, 'BRL')], [refund(7, 'aurora', 'D', 300n, 'BRL')]);
    expect(outcome.applied).toEqual([{ eventId: 7, amount: 200n }]);
    expect(outcome.excess).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 100n, currency: 'BRL' }]);
    expect(outcome.split?.net).toBe(0n);
  });

  it('regra 6: estornos aplicados por id crescente, independente da ordem de entrada', () => {
    const outcome = evaluate(
      [charge(1, 'aurora', 'P', 100n, 'BRL')],
      [refund(3, 'aurora', 'P', 60n, 'BRL'), refund(2, 'aurora', 'P', 60n, 'BRL')],
    );
    expect(outcome.applied).toEqual([
      { eventId: 2, amount: 60n },
      { eventId: 3, amount: 40n },
    ]);
    expect(outcome.excess).toEqual([{ eventId: 3, operator: 'aurora', reference: 'P', amount: 20n, currency: 'BRL' }]);
  });

  it('regra 6: estorno que chega com a inscrição já zerada é excesso por inteiro', () => {
    const outcome = evaluate(
      [charge(1, 'aurora', 'A', 500n, 'BRL')],
      [refund(4, 'aurora', 'A', 500n, 'BRL'), refund(13, 'aurora', 'A', 50n, 'BRL')],
    );
    expect(outcome.applied).toEqual([{ eventId: 4, amount: 500n }]);
    expect(outcome.excess).toEqual([{ eventId: 13, operator: 'aurora', reference: 'A', amount: 50n, currency: 'BRL' }]);
  });

  it('regra 7: sem cobrança, o estorno fica pendente e nada é contabilizado', () => {
    const outcome = evaluate([], [refund(7, 'aurora', 'D', 300n, 'BRL')]);
    expect(outcome.charge).toBeNull();
    expect(outcome.split).toBeNull();
    expect(outcome.brlCents).toBeNull();
    expect(outcome.applied).toEqual([]);
    expect(outcome.excess).toEqual([]);
    expect(outcome.pending).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 300n, currency: 'BRL' }]);
  });

  describe('casos fora das regras', () => {
    it('segunda cobrança viva: vale a de menor id, a outra vira anomalia e não soma', () => {
      const outcome = evaluate([charge(16, 'aurora', 'D', 200n, 'BRL'), charge(8, 'aurora', 'D', 200n, 'BRL')], []);
      expect(outcome.charge?.id).toBe(8);
      expect(outcome.split?.net).toBe(200n);
      expect(outcome.anomalies).toEqual([expect.objectContaining({ eventId: 16, kind: 'extra_charge' })]);
    });

    it('estorno em moeda diferente da cobrança não é aplicado nem fica pendente', () => {
      const outcome = evaluate([charge(1, 'aurora', 'M', 500n, 'BRL')], [refund(2, 'aurora', 'M', 100n, 'USDT')]);
      expect(outcome.split?.net).toBe(500n);
      expect(outcome.applied).toEqual([]);
      expect(outcome.pending).toEqual([]);
      expect(outcome.excess).toEqual([]);
      expect(outcome.anomalies).toEqual([expect.objectContaining({ eventId: 2, kind: 'currency_mismatch' })]);
    });

    it('cobrança sem contrato não é contabilizada e seus estornos esperam', () => {
      const outcome = evaluate([charge(1, 'zeta', 'Z', 500n, 'BRL')], [refund(2, 'zeta', 'Z', 100n, 'BRL')]);
      expect(outcome.charge).toBeNull();
      expect(outcome.split).toBeNull();
      expect(outcome.pending).toEqual([{ eventId: 2, operator: 'zeta', reference: 'Z', amount: 100n, currency: 'BRL' }]);
      expect(outcome.anomalies).toEqual([expect.objectContaining({ eventId: 1, kind: 'missing_terms' })]);
    });
  });
});
