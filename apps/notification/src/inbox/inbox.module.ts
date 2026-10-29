import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InboxEntry, InboxEntrySchema } from './inbox-entry.schema.js';
import { EventsConsumer } from './events.consumer.js';
import { InboxStoreService } from './inbox-store.service.js';
import { InboxController } from './inbox.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InboxEntry.name, schema: InboxEntrySchema },
    ]),
  ],
  controllers: [InboxController],
  providers: [EventsConsumer, InboxStoreService],
})
export class InboxModule {}
