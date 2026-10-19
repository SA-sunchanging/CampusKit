import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, mongoUrl } from '@app/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  imports: [
    MongooseModule.forRoot(mongoUrl('review')),
    AuthModule,
    HealthModule.register('review'),
    ReviewsModule,
  ],
})
export class ReviewModule {}
