import type { OperatorId } from '../feed/FeedEvent';
import { type CurrencyCode, currencyOf } from '../money/Currency';
import type { RakeSplit } from '../rake/RakeSplit';
import type { InscriptionOutcome } from './Inscription';
import type { CurrencyTotals } from './RakeReport';

/** Soma com contador: a linha some quando a última inscrição que contribuía para ela sai. */
interface Bucket {
  net: bigint;
  engine: bigint;
  operator: bigint;
  inscriptions: number;
}

function addTo(bucket: Bucket, split: RakeSplit, sign: 1n | -1n): void {
  bucket.net += sign * split.net;
  bucket.engine += sign * split.engine;
  bucket.operator += sign * split.operator;
  bucket.inscriptions += Number(sign);
}

const toSplit = ({ net, engine, operator }: Bucket): RakeSplit => ({ net, engine, operator });

/**
 * Totais por operador (regras 4 e 9), mantidos por diferença: quando uma inscrição muda,
 * sai a contribuição antiga e entra a nova. Nada é recalculado do zero.
 * Os reais somam as inscrições já arredondadas, nunca o agregado.
 */
export class LedgerTotals {
  private readonly byCurrency = new Map<OperatorId, Map<CurrencyCode, Bucket>>();
  private readonly brlCents = new Map<OperatorId, Bucket>();

  replace(previous: InscriptionOutcome | undefined, next: InscriptionOutcome | undefined): void {
    if (previous) this.apply(previous, -1n);
    if (next) this.apply(next, 1n);
  }

  currencyTotals(): Record<OperatorId, Partial<Record<CurrencyCode, CurrencyTotals>>> {
    const result: Record<OperatorId, Partial<Record<CurrencyCode, CurrencyTotals>>> = {};
    for (const [operator, currencies] of this.byCurrency) {
      const rows: Partial<Record<CurrencyCode, CurrencyTotals>> = {};
      for (const [code, bucket] of currencies) {
        rows[code] = { ...toSplit(bucket), playMoney: currencyOf(code).playMoney };
      }
      result[operator] = rows;
    }
    return result;
  }

  brlTotals(): Record<OperatorId, RakeSplit> {
    return Object.fromEntries([...this.brlCents].map(([operator, bucket]) => [operator, toSplit(bucket)]));
  }

  private apply(outcome: InscriptionOutcome, sign: 1n | -1n): void {
    const { charge, split, brlCents } = outcome;
    if (charge === null || split === null) return;

    const currencies = this.byCurrency.get(charge.operator) ?? new Map<CurrencyCode, Bucket>();
    this.byCurrency.set(charge.operator, currencies);
    const bucket = currencies.get(charge.currency) ?? { net: 0n, engine: 0n, operator: 0n, inscriptions: 0 };
    currencies.set(charge.currency, bucket);
    addTo(bucket, split, sign);
    if (bucket.inscriptions === 0) currencies.delete(charge.currency);
    if (currencies.size === 0) this.byCurrency.delete(charge.operator);

    if (brlCents === null) return;
    const brl = this.brlCents.get(charge.operator) ?? { net: 0n, engine: 0n, operator: 0n, inscriptions: 0 };
    this.brlCents.set(charge.operator, brl);
    addTo(brl, brlCents, sign);
    if (brl.inscriptions === 0) this.brlCents.delete(charge.operator);
  }
}
