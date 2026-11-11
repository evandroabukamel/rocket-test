export type CurrencyCode = 'BRL' | 'USDT' | 'BTC' | 'ETH' | 'FUN';

export interface Currency {
  readonly code: CurrencyCode;
  /** Casas decimais da menor unidade (centavo = 2, satoshi = 8, wei = 18). */
  readonly decimals: number;
  /** Fichas de brincadeira: têm rake, mas nunca entram em total em reais. */
  readonly playMoney: boolean;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, Currency>> = {
  BRL: { code: 'BRL', decimals: 2, playMoney: false },
  USDT: { code: 'USDT', decimals: 6, playMoney: false },
  BTC: { code: 'BTC', decimals: 8, playMoney: false },
  ETH: { code: 'ETH', decimals: 18, playMoney: false },
  FUN: { code: 'FUN', decimals: 0, playMoney: true },
};

/** Moeda de consolidação. Não precisa de cotação: 1 BRL = 1 BRL. */
export const REPORTING_CURRENCY: CurrencyCode = 'BRL';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value);
}

export function currencyOf(code: CurrencyCode): Currency {
  return CURRENCIES[code];
}
