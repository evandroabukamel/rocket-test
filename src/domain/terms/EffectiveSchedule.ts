import type { EventId } from '../feed/FeedEvent';
import { DomainError } from '../shared/errors';

export interface ScheduleEntry<T> {
  readonly fromId: EventId;
  readonly value: T;
}

export class DuplicateScheduleEntryError extends DomainError {
  readonly code = 'duplicate_schedule_entry';

  constructor(readonly fromId: EventId) {
    super(`two schedule rows share from_id ${fromId}`);
  }
}

/**
 * Tabela que muda com o tempo, indexada por id de evento.
 * Vale a linha com o maior `fromId` menor ou igual ao id consultado.
 * A ordem das linhas na entrada não importa; `fromId` repetido é erro de configuração.
 */
export class EffectiveSchedule<T> {
  /** Ordenado por fromId crescente. */
  private readonly entries: readonly ScheduleEntry<T>[];

  constructor(entries: readonly ScheduleEntry<T>[]) {
    const sorted = [...entries].sort((a, b) => a.fromId - b.fromId);
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      if (current && current.fromId === sorted[i - 1]?.fromId) throw new DuplicateScheduleEntryError(current.fromId);
    }
    this.entries = sorted;
  }

  valueAt(eventId: EventId): T | undefined {
    // Busca binária pela última linha com fromId <= eventId.
    let low = 0;
    let high = this.entries.length - 1;
    let found: ScheduleEntry<T> | undefined;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      const entry = this.entries[middle];
      if (entry === undefined) break;
      if (entry.fromId <= eventId) {
        found = entry;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found?.value;
  }
}
