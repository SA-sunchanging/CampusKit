import { EventPublisher } from '@app/messaging';
import { Module } from '@nestjs/common';
import { OutboxRelay } from './outbox-relay.js';

/** The relay that publishes Booking's outbox_events through the shared EventPublisher. */
@Module({
  providers: [EventPublisher, OutboxRelay],
})
export class OutboxModule {}
