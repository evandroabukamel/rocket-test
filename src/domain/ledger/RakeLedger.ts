import type { EventId, FeedEvent } from '../feed/FeedEvent';
import { notImplemented } from '../shared/errors';
import type { TermsCatalog } from '../terms/TermsCatalog';
import type { LedgerSnapshot } from './LedgerSnapshot';
import type { RakeReport } from './RakeReport';

/**
 * - `applied`: evento novo, guardado (inclusive anulação ainda sem alvo).
 * - `duplicate`: id já visto com o mesmo conteúdo; nada muda (regra 5).
 * - `conflict`: id já visto com conteúdo diferente; vale o primeiro (regra 5).
 * - `rejected`: evento novo guardado, mas sem efeito por um caso fora das regras (vira anomalia).
 */
export type ApplyStatus = 'applied' | 'duplicate' | 'conflict' | 'rejected';

/**
 * Raiz de agregado: o livro de rake de todos os operadores.
 * Guarda os eventos por id e mantém, por inscrição, o resultado derivado dos eventos vivos.
 * Cada evento só recalcula a inscrição que ele toca; os totais recebem a diferença.
 */
export class RakeLedger {
  private constructor(private readonly terms: TermsCatalog) {}

  static empty(terms: TermsCatalog): RakeLedger {
    return new RakeLedger(terms);
  }

  static restore(snapshot: LedgerSnapshot, terms: TermsCatalog): RakeLedger {
    return notImplemented(`RakeLedger.restore(v${snapshot.version}, ${String(terms)})`);
  }

  apply(event: FeedEvent): ApplyStatus {
    return notImplemented(`RakeLedger.apply(${event.id}) ${String(this.terms)}`);
  }

  /** Evento que nem virou evento de domínio. Avança o cursor se o id for legível. */
  recordInvalid(eventId: EventId | null, detail: string): void {
    notImplemented(`RakeLedger.recordInvalid(${eventId}, ${detail})`);
  }

  report(): RakeReport {
    return notImplemented('RakeLedger.report');
  }

  snapshot(): LedgerSnapshot {
    return notImplemented('RakeLedger.snapshot');
  }
}
