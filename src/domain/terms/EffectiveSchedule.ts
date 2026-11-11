import type { EventId } from '../feed/FeedEvent';
import { DomainError, notImplemented } from '../shared/errors';

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
  constructor(entries: readonly ScheduleEntry<T>[]) {
    notImplemented(`EffectiveSchedule(${entries.length} entries)`);
  }

  valueAt(eventId: EventId): T | undefined {
    return notImplemented(`EffectiveSchedule.valueAt(${eventId})`);
  }
}
