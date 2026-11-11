import type { MinorUnits } from '../money/MinorUnits';
import { DomainError } from '../shared/errors';

/** 1 bps = 0,01%. 1500 bps = 15%. */
export type BasisPoints = number;

export const BPS_DENOMINATOR = 10_000n;

export class InvalidBasisPointsError extends DomainError {
  readonly code = 'invalid_bps';

  constructor(readonly bps: number) {
    super(`engine_bps must be an integer between 0 and 10000, got ${bps}`);
  }
}

/** Divisão do líquido entre motor e operador. Invariante: engine + operator === net. */
export interface RakeSplit {
  readonly net: MinorUnits;
  readonly engine: MinorUnits;
  readonly operator: MinorUnits;
}

/**
 * Regra 2: engine = floor(net × bps / 10000); o operador fica com o resto.
 * @throws InvalidBasisPointsError para bps fora de 0..10000; RangeError para net negativo (bug de quem chama).
 */
export function splitRake(net: MinorUnits, bps: BasisPoints): RakeSplit {
  if (!Number.isInteger(bps) || bps < 0 || bps > Number(BPS_DENOMINATOR)) throw new InvalidBasisPointsError(bps);
  if (net < 0n) throw new RangeError(`net must not be negative (${net})`);
  const engine = (net * BigInt(bps)) / BPS_DENOMINATOR;
  return { net, engine, operator: net - engine };
}

export const ZERO_SPLIT: RakeSplit = { net: 0n, engine: 0n, operator: 0n };
