import {
  type EventId,
  type FeedEvent,
  type InscriptionKey,
  type MoneyEvent,
  type VoidEvent,
  inscriptionKeyOf,
  sameContent,
} from '../feed/FeedEvent';
import { isCurrencyCode } from '../money/Currency';
import type { TermsCatalog } from '../terms/TermsCatalog';
import type { Anomaly } from './Anomaly';
import { type InscriptionOutcome, evaluateInscription } from './Inscription';
import { LedgerTotals } from './LedgerTotals';
import { type LedgerSnapshot, type SnapshotEvent, UnsupportedSnapshotError } from './LedgerSnapshot';
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
  private cursor: EventId | null = null;
  /** Primeira versão aceita de cada id, na ordem de chegada. */
  private readonly events = new Map<EventId, FeedEvent>();
  private readonly conflicts = new Set<EventId>();
  private readonly duplicates = new Set<EventId>();
  private readonly recordedAnomalies: Anomaly[] = [];

  /** alvo → anulação que o derrubou. */
  private readonly voidedBy = new Map<EventId, EventId>();
  /** alvo ainda não recebido → anulação que espera por ele. */
  private readonly pendingVoids = new Map<EventId, EventId>();
  /** id da anulação rejeitada → motivo. */
  private readonly rejectedVoids = new Map<EventId, Anomaly>();

  /** Todos os eventos de dinheiro de cada inscrição, inclusive os anulados. */
  private readonly inscriptionEvents = new Map<InscriptionKey, EventId[]>();
  private readonly outcomes = new Map<InscriptionKey, InscriptionOutcome>();
  private readonly totals = new LedgerTotals();

  private constructor(private readonly terms: TermsCatalog) {}

  static empty(terms: TermsCatalog): RakeLedger {
    return new RakeLedger(terms);
  }

  /** Reaplica os eventos na ordem de chegada: o estado derivado sai igual, por construção. */
  static restore(snapshot: LedgerSnapshot, terms: TermsCatalog): RakeLedger {
    if (snapshot.version !== 1) throw new UnsupportedSnapshotError(snapshot.version);
    const ledger = new RakeLedger(terms);
    for (const event of snapshot.events) ledger.apply(fromSnapshotEvent(event));
    for (const id of snapshot.conflicts) ledger.conflicts.add(id);
    for (const id of snapshot.duplicatesIgnored) ledger.duplicates.add(id);
    ledger.recordedAnomalies.push(...snapshot.recordedAnomalies);
    ledger.cursor = snapshot.cursor;
    return ledger;
  }

  apply(event: FeedEvent): ApplyStatus {
    this.advanceCursor(event.id);

    const known = this.events.get(event.id);
    if (known) {
      if (sameContent(known, event)) {
        this.duplicates.add(event.id);
        return 'duplicate';
      }
      this.conflicts.add(event.id);
      return 'conflict';
    }

    this.events.set(event.id, event);
    this.resolveWaitingVoid(event);
    if (event.kind === 'void') return this.applyVoid(event);

    const key = inscriptionKeyOf(event);
    const ids = this.inscriptionEvents.get(key) ?? [];
    ids.push(event.id);
    this.inscriptionEvents.set(key, ids);
    this.recompute(key);
    return 'applied';
  }

  /** Evento que nem virou evento de domínio. Avança o cursor se o id for legível. */
  recordInvalid(eventId: EventId | null, detail: string): void {
    if (eventId !== null) this.advanceCursor(eventId);
    this.recordedAnomalies.push({ eventId, kind: 'invalid_event', detail });
  }

  report(): RakeReport {
    const outcomes = [...this.outcomes.values()];
    return {
      cursor: this.cursor,
      totals: this.totals.currencyTotals(),
      totalsBrlCents: this.totals.brlTotals(),
      pendingRefunds: outcomes.flatMap((outcome) => outcome.pending),
      excessRefunds: outcomes.flatMap((outcome) => outcome.excess),
      conflicts: [...this.conflicts],
      duplicatesIgnored: [...this.duplicates],
      voided: [...this.voidedBy.keys()],
      pendingVoids: [...this.pendingVoids.values()],
      anomalies: [
        ...this.recordedAnomalies,
        ...this.rejectedVoids.values(),
        ...outcomes.flatMap((outcome) => outcome.anomalies),
      ],
    };
  }

  snapshot(): LedgerSnapshot {
    return {
      version: 1,
      cursor: this.cursor,
      events: [...this.events.values()].map(toSnapshotEvent),
      conflicts: [...this.conflicts],
      duplicatesIgnored: [...this.duplicates],
      recordedAnomalies: [...this.recordedAnomalies],
    };
  }

  /** Regra 8 e os casos de anulação que as regras não cobrem. */
  private applyVoid(voidEvent: VoidEvent): ApplyStatus {
    const targetId = voidEvent.voidsId;
    const target = this.events.get(targetId);

    const reject = (kind: Anomaly['kind'], detail: string): ApplyStatus => {
      this.rejectedVoids.set(voidEvent.id, { eventId: voidEvent.id, kind, detail });
      return 'rejected';
    };

    if (this.voidedBy.has(targetId) || this.pendingVoids.has(targetId)) {
      return reject('void_already_applied', `event ${targetId} is already voided`);
    }
    if (target === undefined) {
      this.pendingVoids.set(targetId, voidEvent.id);
      return 'applied';
    }
    if (target.kind === 'void') {
      return reject('void_targets_void', `event ${targetId} is itself a void`);
    }

    this.voidedBy.set(targetId, voidEvent.id);
    this.recompute(inscriptionKeyOf(target));
    return 'applied';
  }

  /** Uma anulação chegou antes deste evento: ele já nasce anulado (ou a anulação é rejeitada). */
  private resolveWaitingVoid(event: FeedEvent): void {
    const waitingVoid = this.pendingVoids.get(event.id);
    if (waitingVoid === undefined) return;
    this.pendingVoids.delete(event.id);
    if (event.kind === 'void') {
      this.rejectedVoids.set(waitingVoid, {
        eventId: waitingVoid,
        kind: 'void_targets_void',
        detail: `event ${event.id} is itself a void`,
      });
      return;
    }
    this.voidedBy.set(event.id, waitingVoid);
  }

  private recompute(key: InscriptionKey): void {
    const live = (this.inscriptionEvents.get(key) ?? [])
      .filter((id) => !this.voidedBy.has(id))
      .map((id) => this.events.get(id))
      .filter((event): event is MoneyEvent => event !== undefined && event.kind !== 'void');

    const previous = this.outcomes.get(key);
    const next =
      live.length === 0
        ? undefined
        : evaluateInscription(
            {
              charges: live.filter((event) => event.kind === 'charge'),
              refunds: live.filter((event) => event.kind === 'refund'),
            },
            this.terms,
          );

    this.totals.replace(previous, next);
    if (next) this.outcomes.set(key, next);
    else this.outcomes.delete(key);
  }

  private advanceCursor(id: EventId): void {
    if (this.cursor === null || id > this.cursor) this.cursor = id;
  }
}

function toSnapshotEvent(event: FeedEvent): SnapshotEvent {
  if (event.kind === 'void') return { id: event.id, kind: 'void', voidsId: event.voidsId };
  return { ...event, amount: event.amount.toString() };
}

function fromSnapshotEvent(event: SnapshotEvent): FeedEvent {
  if (event.kind === 'void') return { id: event.id, kind: 'void', voidsId: event.voidsId };
  if (!isCurrencyCode(event.currency)) throw new UnsupportedSnapshotError(`currency ${event.currency}`);
  return { ...event, amount: BigInt(event.amount), currency: event.currency };
}
