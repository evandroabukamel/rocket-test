import { type ChargeEvent, type InscriptionKey, type RefundEvent, inscriptionKeyOf } from '../feed/FeedEvent';
import { currencyOf } from '../money/Currency';
import type { MinorUnits } from '../money/MinorUnits';
import { toBrlCents } from '../money/conversion';
import { type RakeSplit, splitRake } from '../rake/RakeSplit';
import { DomainError } from '../shared/errors';
import type { ChargeTerms, TermsCatalog } from '../terms/TermsCatalog';
import type { Anomaly } from './Anomaly';
import type { RefundEntry } from './RakeReport';

/** Eventos vivos (não anulados) de uma inscrição, em qualquer ordem. Pelo menos um. */
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
  /** Cobrança efetiva: a viva e utilizável de menor id. null enquanto não houver. */
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

const byId = <T extends { readonly id: number }>(events: readonly T[]): T[] => [...events].sort((a, b) => a.id - b.id);

function entryOf(refund: RefundEvent, amount: MinorUnits = refund.amount): RefundEntry {
  return {
    eventId: refund.id,
    operator: refund.operator,
    reference: refund.reference,
    amount,
    currency: refund.currency,
  };
}

/** Cobrança efetiva = primeira (por id) com termos resolvíveis. As demais viram anomalia. */
function pickCharge(charges: readonly ChargeEvent[], catalog: TermsCatalog) {
  const anomalies: Anomaly[] = [];
  let charge: ChargeEvent | null = null;
  let terms: ChargeTerms | null = null;

  for (const candidate of byId(charges)) {
    if (charge !== null) {
      anomalies.push({
        eventId: candidate.id,
        kind: 'extra_charge',
        detail: `inscription already charged by event ${charge.id}`,
      });
      continue;
    }
    try {
      terms = catalog.termsFor(candidate);
      charge = candidate;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      anomalies.push({ eventId: candidate.id, kind: 'missing_terms', detail: error.message });
    }
  }
  return { charge, terms, anomalies };
}

/** Regras 6 e 7: aplica por id crescente até o cobrado; o que passar é excesso. */
function allocateRefunds(charge: ChargeEvent | null, refunds: readonly RefundEvent[]) {
  const applied: AppliedRefund[] = [];
  const excess: RefundEntry[] = [];
  const pending: RefundEntry[] = [];
  const anomalies: Anomaly[] = [];

  if (charge === null) {
    return { applied, excess, pending: byId(refunds).map((refund) => entryOf(refund)), anomalies, refunded: 0n };
  }

  let remaining = charge.amount;
  for (const refund of byId(refunds)) {
    if (refund.currency !== charge.currency) {
      anomalies.push({
        eventId: refund.id,
        kind: 'currency_mismatch',
        detail: `refund in ${refund.currency} for a charge in ${charge.currency} (event ${charge.id})`,
      });
      continue;
    }
    const amount = refund.amount < remaining ? refund.amount : remaining;
    if (amount > 0n) applied.push({ eventId: refund.id, amount });
    if (refund.amount > amount) excess.push(entryOf(refund, refund.amount - amount));
    remaining -= amount;
  }
  return { applied, excess, pending, anomalies, refunded: charge.amount - remaining };
}

/** Regra 4: converte o líquido e a parte do motor; o operador em reais é a diferença. */
function convertToBrl(split: RakeSplit, charge: ChargeEvent, terms: ChargeTerms): RakeSplit | null {
  if (terms.price === null) return null;
  const currency = currencyOf(charge.currency);
  const net = toBrlCents(split.net, currency, terms.price);
  const engine = toBrlCents(split.engine, currency, terms.price);
  return { net, engine, operator: net - engine };
}

/**
 * Regras 2, 3, 4, 6 e 7 para uma inscrição:
 * - cobrança efetiva = viva de menor id; as outras viram `extra_charge`;
 * - estornos aplicados por id crescente até o cobrado; o resto é excesso (aplicação parcial);
 * - estorno em moeda diferente da cobrança vira `currency_mismatch`;
 * - sem cobrança (ou cobrança sem termos), todos os estornos ficam pendentes;
 * - rake e conversão calculados uma vez sobre o líquido, com os termos da cobrança.
 */
export function evaluateInscription(events: InscriptionEvents, catalog: TermsCatalog): InscriptionOutcome {
  const first = events.charges[0] ?? events.refunds[0];
  if (first === undefined) throw new RangeError('an inscription needs at least one event');

  const picked = pickCharge(events.charges, catalog);
  const refunds = allocateRefunds(picked.charge, events.refunds);

  let split: RakeSplit | null = null;
  let brlCents: RakeSplit | null = null;
  if (picked.charge !== null && picked.terms !== null) {
    split = splitRake(picked.charge.amount - refunds.refunded, picked.terms.bps);
    brlCents = convertToBrl(split, picked.charge, picked.terms);
  }

  return {
    key: inscriptionKeyOf(first),
    charge: picked.charge,
    terms: picked.terms,
    split,
    brlCents,
    applied: refunds.applied,
    excess: refunds.excess,
    pending: refunds.pending,
    anomalies: [...picked.anomalies, ...refunds.anomalies],
  };
}
