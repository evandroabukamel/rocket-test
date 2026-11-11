import type { DecodeResult, FeedEventDecoder } from '../../application/ports/FeedEventDecoder';
import { notImplemented } from '../../domain/shared/errors';

/**
 * Adaptador do formato do fio (snake_case, `amount` como texto) para o domínio.
 * - `id` e `voids_id`: inteiros positivos (number seguro);
 * - `kind`: charge | refund | void;
 * - `amount`: validado por `parseMinorUnits`; `currency`: uma das moedas conhecidas;
 * - campos desconhecidos são ignorados (compatibilidade com um motor mais novo).
 */
export class JsonFeedEventDecoder implements FeedEventDecoder {
  decode(raw: unknown): DecodeResult {
    return notImplemented(`JsonFeedEventDecoder.decode(${typeof raw})`);
  }
}
