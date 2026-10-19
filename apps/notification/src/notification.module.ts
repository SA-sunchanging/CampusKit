import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, mongoUrl } from '@app/common';
import { InboxModule } from './inbox/inbox.module.js';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRoot(mongoUrl('notification')),
    AuthModule,
    HealthModule.register('notification'),
    InboxModule,
  ],
})
export class NotificationModule {}
