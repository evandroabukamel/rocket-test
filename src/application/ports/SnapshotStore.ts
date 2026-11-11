import type { LedgerSnapshot } from '../../domain/ledger/LedgerSnapshot';

/** Porta: onde o estado do livro sobrevive a uma queda do processo. */
export interface SnapshotStore {
  load(): Promise<LedgerSnapshot | null>;
  save(snapshot: LedgerSnapshot): Promise<void>;
}
