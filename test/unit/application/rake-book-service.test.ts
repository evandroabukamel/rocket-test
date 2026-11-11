import { describe, expect, it } from 'vitest';
import { RakeBookService } from '../../../src/application/RakeBookService';
import { JsonFeedEventDecoder } from '../../../src/infrastructure/feed/JsonFeedEventDecoder';
import { InMemorySnapshotStore } from '../../../src/infrastructure/persistence/InMemorySnapshotStore';
import { sampleTerms } from '../../support/builders';
import { examplePages } from '../../support/fixtures';

const open = (store = new InMemorySnapshotStore()) =>
  RakeBookService.open({ terms: sampleTerms(), decoder: new JsonFeedEventDecoder(), store });

describe('RakeBookService (caso de uso: ler o feed)', () => {
  it('começa vazio quando não há snapshot', async () => {
    const book = await open();
    expect(book.report().cursor).toBeNull();
  });

  it('resume cada página: aplicados, repetidos, conflitos, rejeitados e inválidos', async () => {
    const book = await open();
    const [page1, page2] = examplePages();
    await book.ingestPage(page1 ?? []);
    expect(await book.ingestPage(page2 ?? [])).toEqual({
      received: 7,
      applied: 5,
      duplicates: 1,
      conflicts: 1,
      rejected: 0,
      invalid: 0,
    });
  });

  it('grava um snapshot ao fim de cada página', async () => {
    const store = new InMemorySnapshotStore();
    const book = await open(store);
    for (const page of examplePages()) await book.ingestPage(page);
    expect(store.saves).toBe(3);
  });

  it('um item inválido não derruba a página', async () => {
    const book = await open();
    const summary = await book.ingestPage([
      { id: 1, kind: 'charge', operator: 'aurora', reference: 'A', amount: 500, currency: 'BRL' },
      { id: 2, kind: 'charge', operator: 'aurora', reference: 'B', amount: '500', currency: 'BRL' },
    ]);
    expect(summary).toMatchObject({ received: 2, applied: 1, invalid: 1 });
    const report = book.report();
    expect(report.totals.aurora?.BRL?.net).toBe(500n);
    expect(report.anomalies).toEqual([expect.objectContaining({ eventId: 1, kind: 'invalid_event' })]);
  });

  it('abre a partir do snapshot salvo por outro processo', async () => {
    const store = new InMemorySnapshotStore();
    const first = await open(store);
    await first.ingestPage(examplePages()[0] ?? []);

    const second = await open(store);
    expect(second.report()).toEqual(first.report());
  });
});
