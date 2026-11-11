import type { Currency } from './Currency';
import type { DecimalPrice } from './DecimalPrice';
import type { MinorUnits } from './MinorUnits';

const CENTS_PER_REAL = 100n;

/**
 * Converte menor unidade de `currency` para centavos de real, arredondando para baixo:
 * floor(units × preço × 100 / 10^decimals). Conta inteira, um único floor no final.
 */
export function toBrlCents(units: MinorUnits, currency: Currency, price: DecimalPrice): bigint {
  if (units < 0n) throw new RangeError(`cannot convert a negative amount (${units})`);
  const numerator = units * price.mantissa * CENTS_PER_REAL;
  const denominator = 10n ** BigInt(currency.decimals) * 10n ** BigInt(price.scale);
  // Divisão de bigint trunca em direção a zero; com valores não negativos isso é floor.
  return numerator / denominator;
}
