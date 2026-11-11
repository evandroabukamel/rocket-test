import { DomainError, notImplemented } from '../shared/errors';

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

/**
 * Converte o texto do feed para menor unidade.
 * Aceita só inteiro positivo em forma canônica (sem sinal, sem zero à esquerda, sem decimal
 * nem expoente), para que "500" e "0500" nunca sejam tratados como conteúdos diferentes.
 */
export function parseMinorUnits(raw: string): MinorUnits {
  return notImplemented(`parseMinorUnits(${raw})`);
}
