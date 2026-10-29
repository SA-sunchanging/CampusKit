import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeadLetterQueriesService } from './dead-letter-queries.service.js';
import { DeadLetter, DeadLetterSchema } from './dead-letter.schema.js';
import { DeadLetterStoreService } from './dead-letter-store.service.js';
import { DeadLettersController } from './dead-letters.controller.js';

/** Keeps dead-lettered events in MongoDB and lists them for administrators. */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: DeadLetter.name, schema: DeadLetterSchema },
    ]),
  ],
  controllers: [DeadLettersController],
  providers: [DeadLetterStoreService, DeadLetterQueriesService],
  exports: [DeadLetterStoreService],
})
export class DeadLettersModule {}
