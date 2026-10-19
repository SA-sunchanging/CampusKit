import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';

@Module({
  controllers: [ReviewsController],
})
export class ReviewsModule {}
