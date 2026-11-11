import { DomainError } from '../shared/errors';

export class InvalidPriceError extends DomainError {
  readonly code = 'invalid_price';

  constructor(readonly raw: string) {
    super(`price must be a positive decimal like "5.40", got "${raw}"`);
  }
}

const DECIMAL = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

/**
 * Preço exato em reais de uma unidade inteira da moeda: valor = mantissa / 10^scale.
 * "5.40" → { mantissa: 540n, scale: 2 }. Sem ponto flutuante em nenhum momento.
 */
export class DecimalPrice {
  private constructor(
    readonly mantissa: bigint,
    readonly scale: number,
  ) {}

  static parse(raw: string): DecimalPrice {
    const match = DECIMAL.exec(raw);
    if (!match) throw new InvalidPriceError(raw);
    const [, integer = '', fraction = ''] = match;
    const mantissa = BigInt(integer + fraction);
    if (mantissa === 0n) throw new InvalidPriceError(raw);
    return new DecimalPrice(mantissa, fraction.length);
  }

  static one(): DecimalPrice {
    return new DecimalPrice(1n, 0);
  }

  /** Forma textual estável, usada no snapshot (ex.: "5.40"). */
  toString(): string {
    if (this.scale === 0) return this.mantissa.toString();
    const digits = this.mantissa.toString().padStart(this.scale + 1, '0');
    return `${digits.slice(0, -this.scale)}.${digits.slice(-this.scale)}`;
  }
}
