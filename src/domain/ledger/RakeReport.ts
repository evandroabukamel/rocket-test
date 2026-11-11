import type { EventId, OperatorId, Reference } from '../feed/FeedEvent';
import type { CurrencyCode } from '../money/Currency';
import type { MinorUnits } from '../money/MinorUnits';
import type { RakeSplit } from '../rake/RakeSplit';
import type { Anomaly } from './Anomaly';

export interface RefundEntry {
  readonly eventId: EventId;
  readonly operator: OperatorId;
  readonly reference: Reference;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
}

export interface CurrencyTotals extends RakeSplit {
  readonly playMoney: boolean;
}

/**
 * Fotografia do livro (regra 9). Valores em bigint; a apresentação decide o formato do fio.
 * A ordem das listas não tem significado.
 */
export interface RakeReport {
  /** Maior id já recebido. null antes do primeiro evento. */
  readonly cursor: EventId | null;
  /** Por operador e moeda, na menor unidade. Uma linha existe se houver cobrança efetiva naquela moeda. */
  readonly totals: Readonly<Record<OperatorId, Partial<Record<CurrencyCode, CurrencyTotals>>>>;
  /** Por operador, em centavos. Soma das inscrições, cada uma já arredondada. FUN fica fora. */
  readonly totalsBrlCents: Readonly<Record<OperatorId, RakeSplit>>;
  readonly pendingRefunds: readonly RefundEntry[];
  readonly excessRefunds: readonly RefundEntry[];
  /** Ids que chegaram de novo com conteúdo diferente. Vale o primeiro. */
  readonly conflicts: readonly EventId[];
  /** Ids que chegaram de novo com o mesmo conteúdo. */
  readonly duplicatesIgnored: readonly EventId[];
  /** Ids de eventos anulados. */
  readonly voided: readonly EventId[];
  /** Ids de anulações cujo alvo ainda não chegou. */
  readonly pendingVoids: readonly EventId[];
  readonly anomalies: readonly Anomaly[];
}
