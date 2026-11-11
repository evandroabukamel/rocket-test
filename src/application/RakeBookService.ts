import type { RakeLedger } from '../domain/ledger/RakeLedger';
import type { RakeReport } from '../domain/ledger/RakeReport';
import { notImplemented } from '../domain/shared/errors';
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
    return notImplemented(`RakeBookService.open(${String(deps)})`);
  }

  /** Um item inválido não derruba a página: vira anomalia e o resto segue. */
  async ingestPage(page: readonly unknown[]): Promise<PageSummary> {
    return notImplemented(`RakeBookService.ingestPage(${page.length}) ${String(this.ledger)} ${String(this.deps)}`);
  }

  report(): RakeReport {
    return notImplemented('RakeBookService.report');
  }
}
