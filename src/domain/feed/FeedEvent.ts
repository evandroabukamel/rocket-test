import type { CurrencyCode } from '../money/Currency';
import type { MinorUnits } from '../money/MinorUnits';

export type EventId = number;
export type OperatorId = string;
export type Reference = string;

interface MoneyEventBase {
  readonly id: EventId;
  readonly operator: OperatorId;
  readonly reference: Reference;
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
}

export interface ChargeEvent extends MoneyEventBase {
  readonly kind: 'charge';
}

export interface RefundEvent extends MoneyEventBase {
  readonly kind: 'refund';
}

/** A rede desfez o evento `voidsId` (reorganização da cadeia). */
export interface VoidEvent {
  readonly id: EventId;
  readonly kind: 'void';
  readonly voidsId: EventId;
}

export type MoneyEvent = ChargeEvent | RefundEvent;
export type FeedEvent = MoneyEvent | VoidEvent;

/**
 * Regra 5: mesmo id com mesmo conteúdo é repetição; com conteúdo diferente é conflito.
 * Compara só os campos de domínio (campos extras do fio já foram descartados pelo decoder).
 */
export function sameContent(a: FeedEvent, b: FeedEvent): boolean {
  if (a.id !== b.id || a.kind !== b.kind) return false;
  if (a.kind === 'void' || b.kind === 'void') {
    return a.kind === 'void' && b.kind === 'void' && a.voidsId === b.voidsId;
  }
  return (
    a.operator === b.operator && a.reference === b.reference && a.amount === b.amount && a.currency === b.currency
  );
}

/** Uma inscrição é identificada por operador + reference (a mesma reference pode existir em dois operadores). */
export type InscriptionKey = string & { readonly __brand: 'InscriptionKey' };

export function inscriptionKeyOf(event: Pick<MoneyEvent, 'operator' | 'reference'>): InscriptionKey {
  return JSON.stringify([event.operator, event.reference]) as InscriptionKey;
}
