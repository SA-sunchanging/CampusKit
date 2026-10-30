import { metrics } from '@opentelemetry/api';

/** Events the consumer handled, by decision: ack, dead-letter, or requeue. */
export const EVENTS_CONSUMED_METRIC = 'campuskit.events.consumed';
/** Dead-lettered messages kept in dead_letters. */
export const DEAD_LETTERS_METRIC = 'campuskit.dead_letters';

// Looked up on each use, not at import, so the counters bind to the meter provider in place then.
const meter = () => metrics.getMeter('notification');

export function countConsumedEvent(decision: string): void {
  meter()
    .createCounter(EVENTS_CONSUMED_METRIC, {
      description: 'Events the inbox consumer handled, by decision',
    })
    .add(1, { decision });
}

export function countKeptDeadLetter(): void {
  meter()
    .createCounter(DEAD_LETTERS_METRIC, {
      description: 'Dead-lettered messages kept for inspection',
    })
    .add(1);
}
