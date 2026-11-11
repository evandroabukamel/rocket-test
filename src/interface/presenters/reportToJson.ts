import type { RakeReport } from '../../domain/ledger/RakeReport';
import { notImplemented } from '../../domain/shared/errors';

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

export function reportToJson(report: RakeReport): ReportJson {
  return notImplemented(`reportToJson(cursor ${report.cursor})`);
}
