import { Module } from '@nestjs/common';
import { EventPublisher } from './event-publisher.js';
import { OutboxRelay } from './outbox-relay.js';

/**
 * The relay that publishes a service's outbox_events through EventPublisher. It uses the
 * importing application's default TypeORM DataSource, whose migrations must create the table
 * from outbox-schema.ts.
 */
@Module({
  providers: [EventPublisher, OutboxRelay],
})
export class OutboxModule {}
