import type { EventId } from '../feed/FeedEvent';

/**
 * Casos que as regras do enunciado não cobrem. Nenhum deles mexe em dinheiro:
 * o evento fica registrado, não é aplicado e aparece no relatório para alguém decidir.
 */
export type AnomalyKind =
  /** O decoder não conseguiu transformar o JSON em evento de domínio. */
  | 'invalid_event'
  /** Segunda cobrança viva para a mesma inscrição. Vale a de menor id. */
  | 'extra_charge'
  /** Estorno numa moeda diferente da cobrança da inscrição. */
  | 'currency_mismatch'
  /** Cobrança sem contrato ou sem cotação vigente no id dela. */
  | 'missing_terms'
  /** Anulação apontando para outra anulação. */
  | 'void_targets_void'
  /** Anulação de evento em moeda que não é cripto (não existe reorganização de cadeia em BRL/FUN). */
  | 'void_targets_non_crypto'
  /** Segunda anulação para um evento que já está anulado. */
  | 'void_already_applied';

export interface Anomaly {
  readonly eventId: EventId | null;
  readonly kind: AnomalyKind;
  readonly detail: string;
}
