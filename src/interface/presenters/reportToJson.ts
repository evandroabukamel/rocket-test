import type { Anomaly } from '../../domain/ledger/Anomaly';
import type { CurrencyTotals, RakeReport, RefundEntry } from '../../domain/ledger/RakeReport';
import type { RakeSplit } from '../../domain/rake/RakeSplit';

interface SplitJson {
  net: string;
  engine: string;
  operator: string;
}

interface RefundEntryJson {
  event_id: number;
  operator: string;
  reference: string;
  amount: string;
  currency: string;
}

/**
 * Formato de saída, próximo do enunciado. Diferença deliberada: `totals_brl_cents` também sai
 * como texto, porque a soma de um mês pode passar de 2^53 e `number` perderia centavos.
 */
export interface ReportJson {
  cursor: number | null;
  totals: Record<string, Record<string, SplitJson & { play_money?: true }>>;
  totals_brl_cents: Record<string, SplitJson>;
  pending_refunds: RefundEntryJson[];
  excess_refunds: RefundEntryJson[];
  conflicts: number[];
  duplicates_ignored: number[];
  voided: number[];
  pending_voids: number[];
  anomalies: { event_id: number | null; kind: string; detail: string }[];
}

const splitJson = ({ net, engine, operator }: RakeSplit): SplitJson => ({
  net: net.toString(),
  engine: engine.toString(),
  operator: operator.toString(),
});

function currencyJson(totals: CurrencyTotals): SplitJson & { play_money?: true } {
  return totals.playMoney ? { ...splitJson(totals), play_money: true } : splitJson(totals);
}

const refundJson = (entry: RefundEntry): RefundEntryJson => ({
  event_id: entry.eventId,
  operator: entry.operator,
  reference: entry.reference,
  amount: entry.amount.toString(),
  currency: entry.currency,
});

const anomalyJson = ({ eventId, kind, detail }: Anomaly) => ({ event_id: eventId, kind, detail });

const mapValues = <A, B>(record: Readonly<Record<string, A>>, fn: (value: A) => B): Record<string, B> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));

export function reportToJson(report: RakeReport): ReportJson {
  return {
    cursor: report.cursor,
    totals: mapValues(report.totals, (currencies) =>
      mapValues(currencies as Record<string, CurrencyTotals>, currencyJson),
    ),
    totals_brl_cents: mapValues(report.totalsBrlCents, splitJson),
    pending_refunds: report.pendingRefunds.map(refundJson),
    excess_refunds: report.excessRefunds.map(refundJson),
    conflicts: [...report.conflicts],
    duplicates_ignored: [...report.duplicatesIgnored],
    voided: [...report.voided],
    pending_voids: [...report.pendingVoids],
    anomalies: report.anomalies.map(anomalyJson),
  };
}
