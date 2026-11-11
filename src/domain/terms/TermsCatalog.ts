import type { ChargeEvent, EventId, OperatorId } from '../feed/FeedEvent';
import type { CurrencyCode } from '../money/Currency';
import type { DecimalPrice } from '../money/DecimalPrice';
import type { BasisPoints } from '../rake/RakeSplit';
import { DomainError, notImplemented } from '../shared/errors';

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

/** Contratos + cotações. Resolve os termos de uma cobrança pelo id dela. */
export class TermsCatalog {
  constructor(contracts: readonly ContractRow[], prices: readonly PriceRow[]) {
    notImplemented(`TermsCatalog(${contracts.length} contracts, ${prices.length} prices)`);
  }

  /** @throws MissingContractError | MissingPriceError */
  termsFor(charge: ChargeEvent): ChargeTerms {
    return notImplemented(`TermsCatalog.termsFor(${charge.id})`);
  }
}
