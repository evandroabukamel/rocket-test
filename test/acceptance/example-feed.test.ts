import { describe, expect, it } from 'vitest';
import { RakeBookService } from '../../src/application/RakeBookService';
import { termsFromJson } from '../../src/infrastructure/config/termsFromJson';
import { JsonFeedEventDecoder } from '../../src/infrastructure/feed/JsonFeedEventDecoder';
import { InMemorySnapshotStore } from '../../src/infrastructure/persistence/InMemorySnapshotStore';
import { type ReportJson, reportToJson } from '../../src/interface/presenters/reportToJson';
import { exampleContracts, examplePages, examplePrices, expectedReport } from '../support/fixtures';

const open = (store: InMemorySnapshotStore) =>
  RakeBookService.open({
    terms: termsFromJson(exampleContracts(), examplePrices()),
    decoder: new JsonFeedEventDecoder(),
    store,
  });

const sortNumbers = (list: readonly number[]) => [...list].sort((a, b) => a - b);
const sortEntries = <T extends { event_id: number }>(list: readonly T[]) => [...list].sort((a, b) => a.event_id - b.event_id);

/** A ordem das listas não importa (regra 9); os números do enunciado são comparados como texto. */
function comparable(report: ReportJson | Record<string, unknown>) {
  const r = report as ReportJson;
  const brl = Object.fromEntries(
    Object.entries(r.totals_brl_cents).map(([operator, split]) => [
      operator,
      { net: String(split.net), engine: String(split.engine), operator: String(split.operator) },
    ]),
  );
  return {
    cursor: r.cursor,
    totals: r.totals,
    totals_brl_cents: brl,
    pending_refunds: sortEntries(r.pending_refunds),
    excess_refunds: sortEntries(r.excess_refunds),
    conflicts: sortNumbers(r.conflicts),
    duplicates_ignored: sortNumbers(r.duplicates_ignored),
    voided: sortNumbers(r.voided),
  };
}

async function runUninterrupted(): Promise<ReportJson> {
  const book = await open(new InMemorySnapshotStore());
  for (const page of examplePages()) await book.ingestPage(page);
  return reportToJson(book.report());
}

describe('Exemplo do enunciado (seção 4)', () => {
  it('as três páginas chegam exatamente nos números esperados', async () => {
    const actual = await runUninterrupted();
    expect(comparable(actual)).toEqual(comparable(expectedReport()));
    expect(actual.pending_voids).toEqual([]);
    expect(actual.anomalies).toEqual([]);
  });

  it('play_money aparece só em FUN', async () => {
    const { totals } = await runUninterrupted();
    expect(totals.delta?.FUN?.play_money).toBe(true);
    expect(totals.delta?.BRL).not.toHaveProperty('play_money');
  });

  describe('regra 10: o processo cai entre duas páginas', () => {
    const pages = examplePages();

    it.each(Array.from({ length: pages.length - 1 }, (_, i) => i + 1))(
      'cai depois da página %i, sobe um processo novo do snapshot e chega no mesmo resultado',
      async (crashAfter) => {
        const store = new InMemorySnapshotStore();
        const before = await open(store);
        for (const page of pages.slice(0, crashAfter)) await before.ingestPage(page);

        const after = await open(store);
        for (const page of pages.slice(crashAfter)) await after.ingestPage(page);

        expect(reportToJson(after.report())).toEqual(await runUninterrupted());
      },
    );

    it('se cair antes de salvar a página, relê a página inteira e o resultado é o mesmo', async () => {
      const store = new InMemorySnapshotStore();
      const before = await open(store);
      await before.ingestPage(pages[0] ?? []);
      // A página 2 é aplicada em memória, mas o processo cai antes de gravar o snapshot dela.
      store.save = async () => {
        throw new Error('process killed');
      };
      await expect(before.ingestPage(pages[1] ?? [])).rejects.toThrow('process killed');
      delete (store as Partial<InMemorySnapshotStore>).save;

      const after = await open(store);
      for (const page of pages.slice(1)) await after.ingestPage(page);

      expect(reportToJson(after.report())).toEqual(await runUninterrupted());
    });
  });
});
