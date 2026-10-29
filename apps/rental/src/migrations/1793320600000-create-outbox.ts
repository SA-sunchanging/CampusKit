import { OUTBOX_INDEX_SQL, OUTBOX_TABLE_SQL } from '@app/messaging';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates Rental's transactional outbox
 * (docs/adr/adr-008-rabbitmq-events-with-transactional-outbox.md). A row is written in the same
 * transaction as the rental change; the relay publishes it and then sets sent_at.
 */
export class CreateOutbox1793320600000 implements MigrationInterface {
  name = 'CreateOutbox1793320600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(OUTBOX_TABLE_SQL);
    await queryRunner.query(OUTBOX_INDEX_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE outbox_events`);
  }
}
