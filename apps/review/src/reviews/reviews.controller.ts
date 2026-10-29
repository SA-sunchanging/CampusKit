import {
  type AuthUser,
  CORRELATION_HEADER,
  CurrentUser,
  JwtAuthGuard,
} from '@app/common';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReceivedReviewsQuery } from './dto/received-reviews.query.js';
import { SubmitReviewDto } from './dto/submit-review.dto.js';
import { ReviewQueriesService } from './review-queries.service.js';
import {
  ReceivedReviewsResponse,
  RentalReviewsResponse,
  ReviewResponse,
} from './review.response.js';
import { ReviewsService } from './reviews.service.js';

/**
 * REST endpoints of the review service, reached through the gateway at /api/review/reviews.
 * Operations owned by this service (see docs/architecture/services.md): submit review, reputation summary.
 */
@ApiTags('reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly queries: ReviewQueriesService,
  ) {}

  /** A participant reviews the other once the rental is CLOSED; once per rental. */
  @Post()
  @ApiCreatedResponse({ type: ReviewResponse })
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitReviewDto,
    @Headers(CORRELATION_HEADER) correlationId: string,
  ): Promise<ReviewResponse> {
    return this.reviews.submit(user, dto, correlationId);
  }

  @Get()
  @ApiOkResponse({ type: ReceivedReviewsResponse })
  received(
    @Query() query: ReceivedReviewsQuery,
  ): Promise<ReceivedReviewsResponse> {
    return this.queries.received(query);
  }

  @Get('rentals/:rentalId')
  @ApiOkResponse({ type: RentalReviewsResponse })
  ofRental(
    @CurrentUser() user: AuthUser,
    @Param('rentalId', ParseUUIDPipe) rentalId: string,
  ): Promise<RentalReviewsResponse> {
    return this.queries.ofRental(user, rentalId);
  }
}
