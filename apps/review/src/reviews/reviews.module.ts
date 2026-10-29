import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RentalClient } from '../clients/rental.client.js';
import { ReputationModule } from '../reputation/reputation.module.js';
import { ReviewQueriesService } from './review-queries.service.js';
import { Review, ReviewSchema } from './review.schema.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [
    AuthModule,
    ReputationModule,
    MongooseModule.forFeature([{ name: Review.name, schema: ReviewSchema }]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewQueriesService, RentalClient],
})
export class ReviewsModule {}
