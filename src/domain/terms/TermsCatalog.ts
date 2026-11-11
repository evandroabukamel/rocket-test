import type { ChargeEvent, EventId, OperatorId } from '../feed/FeedEvent';
import { type CurrencyCode, REPORTING_CURRENCY, currencyOf } from '../money/Currency';
import { DecimalPrice } from '../money/DecimalPrice';
import type { BasisPoints } from '../rake/RakeSplit';
import { DomainError } from '../shared/errors';
import { EffectiveSchedule, type ScheduleEntry } from './EffectiveSchedule';

export interface ContractRow {
  readonly operator: OperatorId;
  readonly fromId: EventId;
  readonly engineBps: BasisPoints;
}

export interface PriceRow {
  readonly currency: CurrencyCode;
  readonly fromId: EventId;
  readonly brl: DecimalPrice;
}

/**
 * Termos presos a uma inscrição no momento da cobrança (regra 3).
 * `price` é null para moeda de brincadeira, que não é convertida (regra 4).
 */
export interface ChargeTerms {
  readonly bps: BasisPoints;
  readonly price: DecimalPrice | null;
}

export class MissingContractError extends DomainError {
  readonly code = 'missing_contract';

  constructor(
    readonly operator: OperatorId,
    readonly eventId: EventId,
  ) {
    super(`no contract for operator "${operator}" valid at event ${eventId}`);
  }
}

export class MissingPriceError extends DomainError {
  readonly code = 'missing_price';

  constructor(
    readonly currency: CurrencyCode,
    readonly eventId: EventId,
  ) {
    super(`no BRL price for ${currency} valid at event ${eventId}`);
  }
}

function groupBy<K, R, T>(rows: readonly R[], keyOf: (row: R) => K, toEntry: (row: R) => ScheduleEntry<T>) {
  const groups = new Map<K, ScheduleEntry<T>[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? [];
    group.push(toEntry(row));
    groups.set(key, group);
  }
  return new Map([...groups].map(([key, entries]) => [key, new EffectiveSchedule(entries)]));
}

/** Contratos + cotações. Resolve os termos de uma cobrança pelo id dela. */
export class TermsCatalog {
  private readonly contracts: ReadonlyMap<OperatorId, EffectiveSchedule<BasisPoints>>;
  private readonly prices: ReadonlyMap<CurrencyCode, EffectiveSchedule<DecimalPrice>>;

  constructor(contracts: readonly ContractRow[], prices: readonly PriceRow[]) {
    this.contracts = groupBy(
      contracts,
      (row) => row.operator,
      (row) => ({ fromId: row.fromId, value: row.engineBps }),
    );
    this.prices = groupBy(
      prices,
      (row) => row.currency,
      (row) => ({ fromId: row.fromId, value: row.brl }),
    );
  }

  /** @throws MissingContractError | MissingPriceError */
  termsFor(charge: ChargeEvent): ChargeTerms {
    const bps = this.contracts.get(charge.operator)?.valueAt(charge.id);
    if (bps === undefined) throw new MissingContractError(charge.operator, charge.id);
    return { bps, price: this.priceFor(charge.currency, charge.id) };
  }

  private priceFor(currency: CurrencyCode, eventId: EventId): DecimalPrice | null {
    if (currencyOf(currency).playMoney) return null;
    if (currency === REPORTING_CURRENCY) return DecimalPrice.one();
    const price = this.prices.get(currency)?.valueAt(eventId);
    if (price === undefined) throw new MissingPriceError(currency, eventId);
    return price;
  }
}
