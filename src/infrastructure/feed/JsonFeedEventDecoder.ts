import type { DecodeResult, FeedEventDecoder } from '../../application/ports/FeedEventDecoder';
import type { EventId } from '../../domain/feed/FeedEvent';
import { isCurrencyCode } from '../../domain/money/Currency';
import { InvalidAmountError, parseMinorUnits } from '../../domain/money/MinorUnits';

type WireObject = Record<string, unknown>;

const isObject = (raw: unknown): raw is WireObject => typeof raw === 'object' && raw !== null && !Array.isArray(raw);

const isEventId = (value: unknown): value is EventId => Number.isSafeInteger(value) && (value as number) > 0;

const isNonEmptyText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Adaptador do formato do fio (snake_case, `amount` como texto) para o domínio.
 * - `id` e `voids_id`: inteiros positivos (number seguro);
 * - `kind`: charge | refund | void;
 * - `amount`: validado por `parseMinorUnits`; `currency`: uma das moedas conhecidas;
 * - campos desconhecidos são ignorados (compatibilidade com um motor mais novo).
 */
export class JsonFeedEventDecoder implements FeedEventDecoder {
  decode(raw: unknown): DecodeResult {
    if (!isObject(raw)) return { ok: false, eventId: null, reason: 'event must be a JSON object' };
    const { id } = raw;
    if (!isEventId(id)) return { ok: false, eventId: null, reason: 'id must be a positive safe integer' };

    const invalid = (reason: string): DecodeResult => ({ ok: false, eventId: id, reason });

    switch (raw.kind) {
      case 'void': {
        const voidsId = raw.voids_id;
        if (!isEventId(voidsId)) return invalid('voids_id must be a positive safe integer');
        if (voidsId === id) return invalid('an event cannot void itself');
        return { ok: true, event: { id, kind: 'void', voidsId } };
      }
      case 'charge':
      case 'refund': {
        const { kind, operator, reference, amount, currency } = raw;
        if (!isNonEmptyText(operator)) return invalid('operator must be a non-empty string');
        if (!isNonEmptyText(reference)) return invalid('reference must be a non-empty string');
        if (typeof amount !== 'string') return invalid('amount must be sent as text');
        if (typeof currency !== 'string' || !isCurrencyCode(currency)) return invalid(`unknown currency ${String(currency)}`);
        try {
          return { ok: true, event: { id, kind, operator, reference, amount: parseMinorUnits(amount), currency } };
        } catch (error) {
          if (error instanceof InvalidAmountError) return invalid(error.message);
          throw error;
        }
      }
      default:
        return invalid(`unknown kind ${String(raw.kind)}`);
    }
  }
}
