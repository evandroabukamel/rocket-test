import type { SnapshotStore } from '../../application/ports/SnapshotStore';
import type { LedgerSnapshot } from '../../domain/ledger/LedgerSnapshot';

/**
 * Guarda o snapshot como texto JSON, não como referência: assim um "processo novo"
 * nos testes não consegue enxergar nenhum objeto do processo antigo.
 */
export class InMemorySnapshotStore implements SnapshotStore {
  private serialized: string | null = null;
  saves = 0;

  async load(): Promise<LedgerSnapshot | null> {
    return this.serialized === null ? null : (JSON.parse(this.serialized) as LedgerSnapshot);
  }

  async save(snapshot: LedgerSnapshot): Promise<void> {
    this.serialized = JSON.stringify(snapshot);
    this.saves += 1;
  }
}
