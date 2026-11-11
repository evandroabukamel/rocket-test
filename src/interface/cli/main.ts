/**
 * Uso: npm start -- [pages.json] [contracts.json] [prices.json] [--state state/ledger.json]
 * Sem argumentos, roda os dados de exemplo do enunciado (pasta data/) sem persistir estado.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { RakeBookService } from '../../application/RakeBookService';
import type { SnapshotStore } from '../../application/ports/SnapshotStore';
import { termsFromJson } from '../../infrastructure/config/termsFromJson';
import { JsonFeedEventDecoder } from '../../infrastructure/feed/JsonFeedEventDecoder';
import { FileSnapshotStore } from '../../infrastructure/persistence/FileSnapshotStore';
import { InMemorySnapshotStore } from '../../infrastructure/persistence/InMemorySnapshotStore';
import { reportToJson } from '../presenters/reportToJson';

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { state: { type: 'string' } },
  });
  const [pagesPath = 'data/pages.json', contractsPath = 'data/contracts.json', pricesPath = 'data/prices.json'] =
    positionals;

  const terms = termsFromJson(await readJson(contractsPath), await readJson(pricesPath));
  const store: SnapshotStore = values.state ? new FileSnapshotStore(values.state) : new InMemorySnapshotStore();
  const book = await RakeBookService.open({ terms, decoder: new JsonFeedEventDecoder(), store });

  const pages = (await readJson(pagesPath)) as unknown[][];
  for (const page of pages) {
    await book.ingestPage(page);
  }

  process.stdout.write(`${JSON.stringify(reportToJson(book.report()), null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
