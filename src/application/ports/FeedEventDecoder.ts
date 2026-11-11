import type { EventId, FeedEvent } from '../../domain/feed/FeedEvent';

export type DecodeResult =
  | { readonly ok: true; readonly event: FeedEvent }
  | { readonly ok: false; readonly eventId: EventId | null; readonly reason: string };

/** Porta: transforma um item cru da página do feed em evento de domínio. */
export interface FeedEventDecoder {
  decode(raw: unknown): DecodeResult;
}
