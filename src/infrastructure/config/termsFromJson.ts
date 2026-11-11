import { notImplemented } from '../../domain/shared/errors';
import type { TermsCatalog } from '../../domain/terms/TermsCatalog';

export class InvalidTermsConfigError extends Error {
  constructor(detail: string) {
    super(`invalid contracts/prices configuration: ${detail}`);
    this.name = 'InvalidTermsConfigError';
  }
}

/**
 * Monta o catálogo a partir das tabelas no formato do enunciado:
 * contratos `{ operator, from_id, engine_bps }` e cotações `{ currency, from_id, brl }`.
 * Configuração inválida é erro de inicialização: lança, não vira anomalia.
 */
export function termsFromJson(contracts: unknown, prices: unknown): TermsCatalog {
  return notImplemented(`termsFromJson(${typeof contracts}, ${typeof prices})`);
}
