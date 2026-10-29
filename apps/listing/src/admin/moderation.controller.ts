import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Call, type CallContext } from '../clients/call-context.js';
import { AdminGuard } from './admin.guard.js';
import { RejectListingDto } from './dto/reject-listing.dto.js';
import { ReviewQueueQuery } from './dto/review-queue.query.js';
import { ModerationService } from './moderation.service.js';
import {
  ReviewItemResponse,
  ReviewQueueResponse,
} from './review-item.response.js';

/**
 * Listing moderation for administrators, reached through the gateway at
 * /api/listing/admin/listings. Every route answers 403 to a student.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'The caller is not an administrator.' })
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/listings')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  @ApiOkResponse({ type: ReviewQueueResponse })
  queue(@Query() query: ReviewQueueQuery): Promise<ReviewQueueResponse> {
    return this.moderation.queue(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ReviewItemResponse })
  approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Call() call: CallContext,
  ): Promise<ReviewItemResponse> {
    return this.moderation.approve(admin, id, call);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ReviewItemResponse })
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectListingDto,
    @Call() call: CallContext,
  ): Promise<ReviewItemResponse> {
    return this.moderation.reject(admin, id, dto.reason, call);
  }
}
