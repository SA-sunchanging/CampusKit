import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates Booking's transactional outbox
 * (docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md). A row is written in the same
 * transaction as the booking change; the relay publishes it and then sets sent_at.
 */
export class CreateOutbox1793280600000 implements MigrationInterface {
  name = 'CreateOutbox1793280600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY,
        type text NOT NULL,
        envelope jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        sent_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX outbox_events_unsent_idx
        ON outbox_events (created_at) WHERE sent_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE outbox_events`);
  }
}
