import type { ChargeEvent, InscriptionKey, RefundEvent } from '../feed/FeedEvent';
import type { MinorUnits } from '../money/MinorUnits';
import type { RakeSplit } from '../rake/RakeSplit';
import { notImplemented } from '../shared/errors';
import type { ChargeTerms, TermsCatalog } from '../terms/TermsCatalog';
import type { Anomaly } from './Anomaly';
import type { RefundEntry } from './RakeReport';

/** Eventos vivos (não anulados) de uma inscrição, em qualquer ordem. */
export interface InscriptionEvents {
  readonly charges: readonly ChargeEvent[];
  readonly refunds: readonly RefundEvent[];
}

export interface AppliedRefund {
  readonly eventId: number;
  readonly amount: MinorUnits;
}

/**
 * Estado de uma inscrição, derivado só dos eventos vivos dela.
 * Por ser derivado, "anular um evento" é só recalcular sem ele (regra 8).
 */
export interface InscriptionOutcome {
  readonly key: InscriptionKey;
  /** Cobrança efetiva: a viva de menor id. null enquanto não houver cobrança utilizável. */
  readonly charge: ChargeEvent | null;
  /** Termos presos à cobrança efetiva (regra 3). */
  readonly terms: ChargeTerms | null;
  /** Na menor unidade da moeda da cobrança. null sem cobrança efetiva. */
  readonly split: RakeSplit | null;
  /** Em centavos de real. null sem cobrança efetiva ou em moeda de brincadeira. */
  readonly brlCents: RakeSplit | null;
  /** Estornos aplicados, por id crescente; o último pode ter sido aplicado em parte. */
  readonly applied: readonly AppliedRefund[];
  /** A parte de cada estorno que passou do cobrado (regra 6). */
  readonly excess: readonly RefundEntry[];
  /** Estornos esperando cobrança (regra 7). */
  readonly pending: readonly RefundEntry[];
  /** Eventos da inscrição que não puderam ser aplicados por um caso fora das regras. */
  readonly anomalies: readonly Anomaly[];
}

/**
 * Regras 2, 3, 4, 6 e 7 para uma inscrição:
 * - cobrança efetiva = viva de menor id; as outras viram `extra_charge`;
 * - estornos aplicados por id crescente até o cobrado; o resto é excesso (aplicação parcial);
 * - estorno em moeda diferente da cobrança vira `currency_mismatch`;
 * - sem cobrança (ou cobrança sem termos), todos os estornos ficam pendentes;
 * - rake e conversão calculados uma vez sobre o líquido, com os termos da cobrança.
 */
export function evaluateInscription(events: InscriptionEvents, terms: TermsCatalog): InscriptionOutcome {
  return notImplemented(
    `evaluateInscription(${events.charges.length} charges, ${events.refunds.length} refunds, ${String(terms)})`,
  );
}
