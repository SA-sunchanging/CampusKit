/**
 * The SQL of the transactional outbox
 * (docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md). A producing service runs both
 * statements in its own migration: a row is written in the same transaction as the domain change,
 * and the relay publishes it and then sets sent_at.
 */
export const OUTBOX_TABLE_SQL = `
  CREATE TABLE outbox_events (
    id uuid PRIMARY KEY,
    type text NOT NULL,
    envelope jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
  )
`;

/** Lets the relay find unsent events, oldest first, without scanning the sent ones. */
export const OUTBOX_INDEX_SQL = `
  CREATE INDEX outbox_events_unsent_idx
    ON outbox_events (created_at) WHERE sent_at IS NULL
`;
