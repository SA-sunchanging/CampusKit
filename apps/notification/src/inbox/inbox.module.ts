import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InboxEntry, InboxEntrySchema } from './inbox-entry.schema.js';
import { EventsConsumer } from './events.consumer.js';
import { InboxQueriesService } from './inbox-queries.service.js';
import { InboxStoreService } from './inbox-store.service.js';
import { InboxController } from './inbox.controller.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: InboxEntry.name, schema: InboxEntrySchema },
    ]),
  ],
  controllers: [InboxController],
  providers: [EventsConsumer, InboxStoreService, InboxQueriesService],
})
export class InboxModule {}
