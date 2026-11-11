import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SnapshotStore } from '../../application/ports/SnapshotStore';
import type { LedgerSnapshot } from '../../domain/ledger/LedgerSnapshot';

/** Snapshot em arquivo. Grava num temporário e renomeia, para nunca deixar um arquivo pela metade. */
export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly path: string) {}

  async load(): Promise<LedgerSnapshot | null> {
    try {
      return JSON.parse(await readFile(this.path, 'utf8')) as LedgerSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(snapshot: LedgerSnapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(snapshot), 'utf8');
    await rename(temporary, this.path);
  }
}
