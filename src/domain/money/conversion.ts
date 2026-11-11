import { notImplemented } from '../shared/errors';
import type { Currency } from './Currency';
import type { DecimalPrice } from './DecimalPrice';
import type { MinorUnits } from './MinorUnits';

/**
 * Converte menor unidade de `currency` para centavos de real, arredondando para baixo:
 * floor(units × preço × 100 / 10^decimals). Conta inteira, um único floor no final.
 */
export function toBrlCents(units: MinorUnits, currency: Currency, price: DecimalPrice): bigint {
  return notImplemented(`toBrlCents(${units}, ${currency.code}, ${String(price)})`);
}
