import type { EventId } from '../feed/FeedEvent';
import { DomainError } from '../shared/errors';
import type { Anomaly } from './Anomaly';

export class UnsupportedSnapshotError extends DomainError {
  readonly code = 'unsupported_snapshot';

  constructor(readonly version: unknown) {
    super(`cannot restore snapshot version ${String(version)}`);
  }
}

/** Evento em forma JSON-segura: quantias como texto, nunca como number. */
export type SnapshotEvent =
  | {
      readonly id: EventId;
      readonly kind: 'charge' | 'refund';
      readonly operator: string;
      readonly reference: string;
      readonly amount: string;
      readonly currency: string;
    }
  | { readonly id: EventId; readonly kind: 'void'; readonly voidsId: EventId };

/**
 * Memento do livro (regra 10). Só dados JSON; sobrevive a `JSON.stringify`/`JSON.parse`
 * e a um processo novo. Os totais não são gravados: são derivados dos eventos na restauração.
 */
export interface LedgerSnapshot {
  readonly version: 1;
  readonly cursor: EventId | null;
  /** Primeira versão aceita de cada id, inclusive anulações. */
  readonly events: readonly SnapshotEvent[];
  readonly conflicts: readonly EventId[];
  readonly duplicatesIgnored: readonly EventId[];
  /** Anomalias que não são deriváveis dos eventos (ex.: evento inválido). */
  readonly recordedAnomalies: readonly Anomaly[];
}
