import { CURRENCIES, REPORTING_CURRENCY, isCurrencyCode } from '../../domain/money/Currency';
import { DecimalPrice } from '../../domain/money/DecimalPrice';
import { BPS_DENOMINATOR } from '../../domain/rake/RakeSplit';
import { DomainError } from '../../domain/shared/errors';
import { type ContractRow, type PriceRow, TermsCatalog } from '../../domain/terms/TermsCatalog';

export class InvalidTermsConfigError extends Error {
  constructor(detail: string) {
    super(`invalid contracts/prices configuration: ${detail}`);
    this.name = 'InvalidTermsConfigError';
  }
}

type Row = Record<string, unknown>;

function rowsOf(value: unknown, table: string): Row[] {
  if (!Array.isArray(value)) throw new InvalidTermsConfigError(`${table} must be a list`);
  return value.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new InvalidTermsConfigError(`${table}[${index}] must be an object`);
    }
    return row as Row;
  });
}

function fromIdOf(row: Row, where: string): number {
  const fromId = row.from_id;
  if (!Number.isSafeInteger(fromId) || (fromId as number) < 0) {
    throw new InvalidTermsConfigError(`${where}.from_id must be a non-negative integer`);
  }
  return fromId as number;
}

function contractOf(row: Row, index: number): ContractRow {
  const where = `contracts[${index}]`;
  const { operator, engine_bps: bps } = row;
  if (typeof operator !== 'string' || operator.length === 0) {
    throw new InvalidTermsConfigError(`${where}.operator must be a non-empty string`);
  }
  if (!Number.isInteger(bps) || (bps as number) < 0 || (bps as number) > Number(BPS_DENOMINATOR)) {
    throw new InvalidTermsConfigError(`${where}.engine_bps must be an integer between 0 and 10000`);
  }
  return { operator, fromId: fromIdOf(row, where), engineBps: bps as number };
}

function priceOf(row: Row, index: number): PriceRow {
  const where = `prices[${index}]`;
  const { currency, brl } = row;
  if (typeof currency !== 'string' || !isCurrencyCode(currency)) {
    throw new InvalidTermsConfigError(`${where}.currency is unknown`);
  }
  if (currency === REPORTING_CURRENCY || CURRENCIES[currency].playMoney) {
    throw new InvalidTermsConfigError(`${where}: ${currency} has no BRL price`);
  }
  if (typeof brl !== 'string') throw new InvalidTermsConfigError(`${where}.brl must be decimal text`);
  return { currency, fromId: fromIdOf(row, where), brl: DecimalPrice.parse(brl) };
}

/**
 * Monta o catálogo a partir das tabelas no formato do enunciado:
 * contratos `{ operator, from_id, engine_bps }` e cotações `{ currency, from_id, brl }`.
 * Configuração inválida é erro de inicialização: lança, não vira anomalia.
 */
export function termsFromJson(contracts: unknown, prices: unknown): TermsCatalog {
  try {
    return new TermsCatalog(rowsOf(contracts, 'contracts').map(contractOf), rowsOf(prices, 'prices').map(priceOf));
  } catch (error) {
    if (error instanceof DomainError) throw new InvalidTermsConfigError(error.message);
    throw error;
  }
}
