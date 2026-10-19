import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the review service, reached through the gateway at /api/review/reviews.
 * Operations owned by this service (see docs/architecture/services.md): submit review, reputation summary.
 */
@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
