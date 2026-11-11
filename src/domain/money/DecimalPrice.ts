import { DomainError, notImplemented } from '../shared/errors';

export class InvalidPriceError extends DomainError {
  readonly code = 'invalid_price';

  constructor(readonly raw: string) {
    super(`price must be a positive decimal like "5.40", got "${raw}"`);
  }
}

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
    return notImplemented(`DecimalPrice.parse(${raw})`);
  }

  static one(): DecimalPrice {
    return new DecimalPrice(1n, 0);
  }

  /** Forma textual estável, usada no snapshot (ex.: "5.40"). */
  toString(): string {
    return notImplemented('DecimalPrice.toString');
  }
}
