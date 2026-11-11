import { type ApplyStatus, RakeLedger } from '../domain/ledger/RakeLedger';
import type { RakeReport } from '../domain/ledger/RakeReport';
import type { TermsCatalog } from '../domain/terms/TermsCatalog';
import type { FeedEventDecoder } from './ports/FeedEventDecoder';
import type { SnapshotStore } from './ports/SnapshotStore';

export interface PageSummary {
  readonly received: number;
  readonly applied: number;
  readonly duplicates: number;
  readonly conflicts: number;
  readonly rejected: number;
  readonly invalid: number;
}

export interface RakeBookDeps {
  readonly terms: TermsCatalog;
  readonly decoder: FeedEventDecoder;
  readonly store: SnapshotStore;
}

const SUMMARY_FIELD: Record<ApplyStatus, keyof Omit<PageSummary, 'received' | 'invalid'>> = {
  applied: 'applied',
  duplicate: 'duplicates',
  conflict: 'conflicts',
  rejected: 'rejected',
};

/**
 * Caso de uso: ler o feed página a página.
 * Ao abrir, retoma do último snapshot salvo (ou começa vazio). Ao fim de cada página,
 * grava um snapshot: se o processo cair no meio de uma página, ela é relida e as repetições
 * são absorvidas pela regra 5.
 */
export class RakeBookService {
  private constructor(
    private readonly ledger: RakeLedger,
    private readonly deps: RakeBookDeps,
  ) {}

  static async open(deps: RakeBookDeps): Promise<RakeBookService> {
    const snapshot = await deps.store.load();
    const ledger = snapshot ? RakeLedger.restore(snapshot, deps.terms) : RakeLedger.empty(deps.terms);
    return new RakeBookService(ledger, deps);
  }

  /** Um item inválido não derruba a página: vira anomalia e o resto segue. */
  async ingestPage(page: readonly unknown[]): Promise<PageSummary> {
    const summary = { received: page.length, applied: 0, duplicates: 0, conflicts: 0, rejected: 0, invalid: 0 };
    for (const raw of page) {
      const decoded = this.deps.decoder.decode(raw);
      if (decoded.ok) {
        summary[SUMMARY_FIELD[this.ledger.apply(decoded.event)]] += 1;
      } else {
        this.ledger.recordInvalid(decoded.eventId, decoded.reason);
        summary.invalid += 1;
      }
    }
    await this.deps.store.save(this.ledger.snapshot());
    return summary;
  }

  report(): RakeReport {
    return this.ledger.report();
  }
}
