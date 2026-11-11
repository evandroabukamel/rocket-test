import { DomainError } from '../shared/errors';

/**
 * Quantia na menor unidade da moeda. Sempre `bigint`: 25 ETH em wei já não cabem em 64 bits,
 * e `number` perde precisão acima de 2^53.
 */
export type MinorUnits = bigint;

export class InvalidAmountError extends DomainError {
  readonly code = 'invalid_amount';

  constructor(readonly raw: string) {
    super(`amount must be a positive integer in canonical form, got "${raw}"`);
  }
}

/** Só dígitos ASCII, sem zero à esquerda, e diferente de zero. */
const CANONICAL_POSITIVE_INTEGER = /^[1-9][0-9]*$/;

/**
 * Converte o texto do feed para menor unidade.
 * Aceita só inteiro positivo em forma canônica (sem sinal, sem zero à esquerda, sem decimal
 * nem expoente), para que "500" e "0500" nunca sejam tratados como conteúdos diferentes.
 */
export function parseMinorUnits(raw: string): MinorUnits {
  if (!CANONICAL_POSITIVE_INTEGER.test(raw)) throw new InvalidAmountError(raw);
  return BigInt(raw);
}
