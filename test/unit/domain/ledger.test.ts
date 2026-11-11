import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '../../../src/domain/feed/FeedEvent';
import { type LedgerSnapshot, UnsupportedSnapshotError } from '../../../src/domain/ledger/LedgerSnapshot';
import { RakeLedger } from '../../../src/domain/ledger/RakeLedger';
import type { RakeReport } from '../../../src/domain/ledger/RakeReport';
import { ETH, charge, refund, sampleTerms, voidOf } from '../../support/builders';

function ledgerWith(...events: FeedEvent[]): RakeLedger {
  const ledger = RakeLedger.empty(sampleTerms());
  for (const event of events) ledger.apply(event);
  return ledger;
}

/** A parte do relatório que é dinheiro: o que tem de ser igual "como se o evento nunca tivesse chegado". */
function money(report: RakeReport) {
  const byId = (a: { eventId: number }, b: { eventId: number }) => a.eventId - b.eventId;
  return {
    totals: report.totals,
    totalsBrlCents: report.totalsBrlCents,
    pendingRefunds: [...report.pendingRefunds].sort(byId),
    excessRefunds: [...report.excessRefunds].sort(byId),
  };
}

describe('RakeLedger', () => {
  describe('cursor', () => {
    it('é null antes do primeiro evento', () => {
      expect(RakeLedger.empty(sampleTerms()).report().cursor).toBeNull();
    });

    it('é o maior id recebido, mesmo que um id menor chegue depois', () => {
      const ledger = ledgerWith(charge(10, 'aurora', 'A', 500n, 'BRL'), charge(3, 'aurora', 'B', 500n, 'BRL'));
      expect(ledger.report().cursor).toBe(10);
    });

    it('ids podem pular números', () => {
      expect(ledgerWith(charge(1, 'aurora', 'A', 1n, 'BRL'), charge(99, 'aurora', 'B', 1n, 'BRL')).report().cursor).toBe(99);
    });
  });

  describe('totais (regra 9)', () => {
    it('separa por operador e por moeda, na menor unidade', () => {
      const report = ledgerWith(
        charge(1, 'aurora', 'A', 500n, 'BRL'),
        charge(2, 'aurora', 'B', 2_500_000n, 'USDT'),
        charge(3, 'delta', 'C', 400n, 'BRL'),
      ).report();
      expect(report.totals.aurora?.BRL).toEqual({ net: 500n, engine: 75n, operator: 425n, playMoney: false });
      expect(report.totals.aurora?.USDT).toEqual({ net: 2_500_000n, engine: 375_000n, operator: 2_125_000n, playMoney: false });
      expect(report.totals.delta?.BRL).toEqual({ net: 400n, engine: 40n, operator: 360n, playMoney: false });
    });

    it('mantém a linha da moeda com zero quando a inscrição foi devolvida por inteiro', () => {
      const report = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'), refund(4, 'aurora', 'A', 500n, 'BRL')).report();
      expect(report.totals.aurora?.BRL).toEqual({ net: 0n, engine: 0n, operator: 0n, playMoney: false });
    });

    it('regra 4: total em reais é a soma das inscrições já arredondadas (não arredonda o agregado)', () => {
      // Cada inscrição vale 0,99954 centavo → 0. Somando antes de arredondar daria 1.
      const report = ledgerWith(charge(1, 'aurora', 'U1', 1_851n, 'USDT'), charge(2, 'aurora', 'U2', 1_851n, 'USDT')).report();
      expect(report.totalsBrlCents.aurora).toEqual({ net: 0n, engine: 0n, operator: 0n });
    });

    it('regra 4: FUN aparece nos totais da moeda, marcado como brincadeira, e fica fora dos reais', () => {
      const report = ledgerWith(charge(6, 'delta', 'H', 1000n, 'FUN'), charge(14, 'delta', 'F', 400n, 'BRL')).report();
      expect(report.totals.delta?.FUN).toEqual({ net: 1000n, engine: 100n, operator: 900n, playMoney: true });
      expect(report.totalsBrlCents.delta).toEqual({ net: 400n, engine: 80n, operator: 320n });
    });

    it('regra 3: cotação presa à cobrança no consolidado (ETH a 20000 no id 3, 19000 no id 12)', () => {
      const report = ledgerWith(charge(3, 'aurora', 'C', 1n * ETH, 'ETH'), charge(12, 'aurora', 'G', 1n * ETH, 'ETH')).report();
      expect(report.totalsBrlCents.aurora?.net).toBe(2_000_000n + 1_900_000n);
    });
  });

  describe('regra 5: repetidos e conflitos', () => {
    it('mesmo id com mesmo conteúdo não muda nada', () => {
      const ledger = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'), refund(4, 'aurora', 'A', 200n, 'BRL'));
      const before = money(ledger.report());
      expect(ledger.apply(refund(4, 'aurora', 'A', 200n, 'BRL'))).toBe('duplicate');
      expect(money(ledger.report())).toEqual(before);
      expect(ledger.report().duplicatesIgnored).toEqual([4]);
    });

    it('um id repetido várias vezes aparece uma vez só na lista', () => {
      const ledger = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'));
      ledger.apply(charge(1, 'aurora', 'A', 500n, 'BRL'));
      ledger.apply(charge(1, 'aurora', 'A', 500n, 'BRL'));
      expect(ledger.report().duplicatesIgnored).toEqual([1]);
    });

    it('mesmo id com conteúdo diferente: vale o primeiro e o id vai para conflitos', () => {
      const ledger = ledgerWith(charge(5, 'delta', 'E', 150_000n, 'BTC'));
      expect(ledger.apply(charge(5, 'delta', 'E', 160_000n, 'BTC'))).toBe('conflict');
      expect(ledger.report().totals.delta?.BTC?.net).toBe(150_000n);
      expect(ledger.report().conflicts).toEqual([5]);
    });

    it('depois de um conflito, a versão original repetida ainda é só repetição', () => {
      const ledger = ledgerWith(charge(5, 'delta', 'E', 150_000n, 'BTC'), charge(5, 'delta', 'E', 160_000n, 'BTC'));
      expect(ledger.apply(charge(5, 'delta', 'E', 150_000n, 'BTC'))).toBe('duplicate');
      expect(ledger.report().totals.delta?.BTC?.net).toBe(150_000n);
    });
  });

  describe('regras 6 e 7: excesso e estorno antes da cobrança', () => {
    it('estorno antes da cobrança fica pendente e não entra em total nenhum', () => {
      const report = ledgerWith(refund(7, 'aurora', 'D', 300n, 'BRL')).report();
      expect(report.pendingRefunds).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 300n, currency: 'BRL' }]);
      expect(report.totals.aurora).toBeUndefined();
    });

    it('quando a cobrança chega, o pendente é aplicado respeitando o limite do cobrado', () => {
      const report = ledgerWith(refund(7, 'aurora', 'D', 300n, 'BRL'), charge(8, 'aurora', 'D', 200n, 'BRL')).report();
      expect(report.pendingRefunds).toEqual([]);
      expect(report.excessRefunds).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 100n, currency: 'BRL' }]);
      expect(report.totals.aurora?.BRL?.net).toBe(0n);
    });

    it('o estorno de outro operador com a mesma reference não é aplicado', () => {
      const report = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'), refund(2, 'delta', 'A', 500n, 'BRL')).report();
      expect(report.totals.aurora?.BRL?.net).toBe(500n);
      expect(report.pendingRefunds).toEqual([{ eventId: 2, operator: 'delta', reference: 'A', amount: 500n, currency: 'BRL' }]);
    });
  });

  describe('regra 8: anulação', () => {
    it('cobrança anulada some; os estornos dela voltam a ficar pendentes e o excesso desaparece', () => {
      const ledger = ledgerWith(refund(7, 'aurora', 'D', 300n, 'ETH'), charge(8, 'aurora', 'D', 200n, 'ETH'));
      expect(ledger.apply(voidOf(11, 8))).toBe('applied');
      const report = ledger.report();
      expect(report.voided).toEqual([8]);
      expect(report.excessRefunds).toEqual([]);
      expect(report.pendingRefunds).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 300n, currency: 'ETH' }]);
      expect(report.totals.aurora).toBeUndefined();
    });

    it('nova cobrança da mesma inscrição aplica os pendentes, com os termos da cobrança nova', () => {
      // delta: 1000 bps no id 5, 2000 bps no id 9.
      const report = ledgerWith(
        charge(5, 'delta', 'X', 1000n, 'ETH'),
        refund(6, 'delta', 'X', 100n, 'ETH'),
        voidOf(7, 5),
        charge(9, 'delta', 'X', 1000n, 'ETH'),
      ).report();
      expect(report.totals.delta?.ETH).toEqual({ net: 900n, engine: 180n, operator: 720n, playMoney: false });
      expect(report.pendingRefunds).toEqual([]);
    });

    it('estorno anulado libera espaço para um estorno que tinha virado excesso', () => {
      const report = ledgerWith(
        charge(1, 'aurora', 'G', 100n, 'ETH'),
        refund(2, 'aurora', 'G', 100n, 'ETH'),
        refund(3, 'aurora', 'G', 50n, 'ETH'),
        voidOf(4, 2),
      ).report();
      expect(report.excessRefunds).toEqual([]);
      expect(report.totals.aurora?.ETH?.net).toBe(50n);
      expect(report.voided).toEqual([2]);
    });

    it('o livro fica exatamente como estaria se o evento anulado nunca tivesse chegado', () => {
      const common: FeedEvent[] = [
        refund(2, 'aurora', 'G', 1n * ETH, 'ETH'),
        charge(3, 'aurora', 'K', 500n, 'BRL'),
        charge(5, 'delta', 'C', 25n * ETH, 'ETH'),
        refund(6, 'delta', 'C', 5n * ETH, 'ETH'),
      ];
      const withVoided = ledgerWith(charge(1, 'aurora', 'G', 3n * ETH, 'ETH'), ...common, voidOf(9, 1));
      const neverArrived = ledgerWith(...common);
      expect(money(withVoided.report())).toEqual(money(neverArrived.report()));
    });

    it('anulação antes do alvo fica pendente; quando o alvo chega, ele já nasce anulado', () => {
      const ledger = ledgerWith(voidOf(11, 8));
      expect(ledger.report().pendingVoids).toEqual([11]);
      ledger.apply(charge(8, 'aurora', 'D', 200n, 'ETH'));
      const report = ledger.report();
      expect(report.pendingVoids).toEqual([]);
      expect(report.voided).toEqual([8]);
      expect(report.totals.aurora).toBeUndefined();
    });

    it('o evento anulado repetido numa página relida continua anulado', () => {
      const ledger = ledgerWith(charge(8, 'aurora', 'D', 200n, 'ETH'), voidOf(11, 8));
      expect(ledger.apply(charge(8, 'aurora', 'D', 200n, 'ETH'))).toBe('duplicate');
      expect(ledger.report().totals.aurora).toBeUndefined();
    });

    it('a anulação repetida é só repetição', () => {
      const ledger = ledgerWith(charge(8, 'aurora', 'D', 200n, 'ETH'), voidOf(11, 8));
      expect(ledger.apply(voidOf(11, 8))).toBe('duplicate');
      expect(ledger.report().voided).toEqual([8]);
    });

    describe('casos fora das regras', () => {
      it('anulação de anulação é rejeitada; a primeira anulação continua valendo', () => {
        const ledger = ledgerWith(charge(8, 'aurora', 'D', 200n, 'ETH'), voidOf(11, 8));
        expect(ledger.apply(voidOf(12, 11))).toBe('rejected');
        const report = ledger.report();
        expect(report.voided).toEqual([8]);
        expect(report.anomalies).toEqual([expect.objectContaining({ eventId: 12, kind: 'void_targets_void' })]);
      });

      it('anulação de evento em BRL é rejeitada e o evento continua contando', () => {
        const ledger = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'));
        expect(ledger.apply(voidOf(2, 1))).toBe('rejected');
        const report = ledger.report();
        expect(report.voided).toEqual([]);
        expect(report.totals.aurora?.BRL?.net).toBe(500n);
        expect(report.anomalies).toEqual([expect.objectContaining({ eventId: 2, kind: 'void_targets_non_crypto' })]);
      });

      it('anulação pendente cujo alvo chega em FUN também é rejeitada', () => {
        const ledger = ledgerWith(voidOf(2, 1), charge(1, 'delta', 'H', 1000n, 'FUN'));
        const report = ledger.report();
        expect(report.pendingVoids).toEqual([]);
        expect(report.voided).toEqual([]);
        expect(report.totals.delta?.FUN?.net).toBe(1000n);
        expect(report.anomalies).toEqual([expect.objectContaining({ eventId: 2, kind: 'void_targets_non_crypto' })]);
      });

      it('segunda anulação para o mesmo alvo é rejeitada', () => {
        const ledger = ledgerWith(charge(8, 'aurora', 'D', 200n, 'ETH'), voidOf(11, 8));
        expect(ledger.apply(voidOf(12, 8))).toBe('rejected');
        expect(ledger.report().anomalies).toEqual([expect.objectContaining({ eventId: 12, kind: 'void_already_applied' })]);
      });
    });
  });

  describe('eventos inválidos', () => {
    it('ficam registrados como anomalia e avançam o cursor quando o id é legível', () => {
      const ledger = ledgerWith(charge(1, 'aurora', 'A', 500n, 'BRL'));
      ledger.recordInvalid(7, 'amount must be text');
      const report = ledger.report();
      expect(report.cursor).toBe(7);
      expect(report.anomalies).toEqual([{ eventId: 7, kind: 'invalid_event', detail: 'amount must be text' }]);
    });

    it('sem id legível, não mexem no cursor', () => {
      const ledger = ledgerWith(charge(3, 'aurora', 'A', 500n, 'BRL'));
      ledger.recordInvalid(null, 'not an object');
      expect(ledger.report().cursor).toBe(3);
    });
  });

  describe('regra 10: snapshot e retomada', () => {
    const roundTrip = (ledger: RakeLedger): LedgerSnapshot => JSON.parse(JSON.stringify(ledger.snapshot()));

    it('o snapshot é JSON puro (sem bigint), e sobrevive a stringify/parse', () => {
      const ledger = ledgerWith(charge(3, 'delta', 'C', 25n * ETH, 'ETH'));
      expect(() => JSON.stringify(ledger.snapshot())).not.toThrow();
      expect(roundTrip(ledger).version).toBe(1);
    });

    it('restaurar dá exatamente o mesmo relatório', () => {
      const ledger = ledgerWith(
        charge(1, 'aurora', 'A', 500n, 'BRL'),
        charge(1, 'aurora', 'A', 500n, 'BRL'),
        charge(1, 'aurora', 'A', 999n, 'BRL'),
        refund(7, 'aurora', 'D', 300n, 'ETH'),
        voidOf(20, 19),
        charge(3, 'delta', 'C', 25n * ETH, 'ETH'),
        voidOf(4, 3),
      );
      ledger.recordInvalid(30, 'bad');
      const restored = RakeLedger.restore(roundTrip(ledger), sampleTerms());
      expect(restored.report()).toEqual(ledger.report());
    });

    it('depois de restaurado, continua reconhecendo repetidos e conflitos de antes', () => {
      const restored = RakeLedger.restore(roundTrip(ledgerWith(charge(5, 'delta', 'E', 150_000n, 'BTC'))), sampleTerms());
      expect(restored.apply(charge(5, 'delta', 'E', 150_000n, 'BTC'))).toBe('duplicate');
      expect(restored.apply(charge(5, 'delta', 'E', 160_000n, 'BTC'))).toBe('conflict');
    });

    it('pendências de antes da queda são resolvidas depois da retomada', () => {
      const restored = RakeLedger.restore(
        roundTrip(ledgerWith(refund(7, 'aurora', 'D', 300n, 'ETH'), voidOf(20, 19))),
        sampleTerms(),
      );
      restored.apply(charge(8, 'aurora', 'D', 200n, 'ETH'));
      restored.apply(charge(19, 'aurora', 'Z', 1n, 'ETH'));
      const report = restored.report();
      expect(report.excessRefunds).toEqual([{ eventId: 7, operator: 'aurora', reference: 'D', amount: 100n, currency: 'ETH' }]);
      expect(report.voided).toEqual([19]);
    });

    it('rejeita snapshot de versão desconhecida', () => {
      const snapshot = { ...roundTrip(ledgerWith()), version: 2 } as unknown as LedgerSnapshot;
      expect(() => RakeLedger.restore(snapshot, sampleTerms())).toThrow(UnsupportedSnapshotError);
    });
  });
});
