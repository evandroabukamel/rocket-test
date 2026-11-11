import type { ChargeEvent, OperatorId, RefundEvent, VoidEvent } from '../../src/domain/feed/FeedEvent';
import type { CurrencyCode } from '../../src/domain/money/Currency';
import { DecimalPrice } from '../../src/domain/money/DecimalPrice';
import { type ContractRow, type PriceRow, TermsCatalog } from '../../src/domain/terms/TermsCatalog';

export function charge(
  id: number,
  operator: OperatorId,
  reference: string,
  amount: bigint,
  currency: CurrencyCode,
): ChargeEvent {
  return { id, kind: 'charge', operator, reference, amount, currency };
}

export function refund(
  id: number,
  operator: OperatorId,
  reference: string,
  amount: bigint,
  currency: CurrencyCode,
): RefundEvent {
  return { id, kind: 'refund', operator, reference, amount, currency };
}

export function voidOf(id: number, voidsId: number): VoidEvent {
  return { id, kind: 'void', voidsId };
}

/** Contratos e cotações do enunciado. Função (e não constante) para só executar dentro do teste. */
export function sampleContracts(): ContractRow[] {
  return [
    { operator: 'aurora', fromId: 1, engineBps: 1500 },
    { operator: 'delta', fromId: 1, engineBps: 1000 },
    { operator: 'delta', fromId: 8, engineBps: 2000 },
  ];
}

export function samplePrices(): PriceRow[] {
  return [
    { currency: 'USDT', fromId: 1, brl: DecimalPrice.parse('5.40') },
    { currency: 'USDT', fromId: 9, brl: DecimalPrice.parse('5.35') },
    { currency: 'BTC', fromId: 1, brl: DecimalPrice.parse('350000.00') },
    { currency: 'ETH', fromId: 1, brl: DecimalPrice.parse('20000.00') },
    { currency: 'ETH', fromId: 12, brl: DecimalPrice.parse('19000.00') },
  ];
}

export function sampleTerms(): TermsCatalog {
  return new TermsCatalog(sampleContracts(), samplePrices());
}

export const ETH = 10n ** 18n;
