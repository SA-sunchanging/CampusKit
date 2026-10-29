import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Review, ReviewSchema } from '../reviews/review.schema.js';
import { InternalReputationController } from './internal-reputation.controller.js';
import { ReputationService } from './reputation.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
  ],
  controllers: [InternalReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}
