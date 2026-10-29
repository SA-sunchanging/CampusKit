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
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminGuard } from '../admin/admin.guard.js';
import { CorrelationId } from '../events/correlation-id.js';
import { RejectStudentDto } from './dto/reject-student.dto.js';
import { StudentQueueQuery } from './dto/student-queue.query.js';
import {
  StudentQueueResponse,
  StudentReviewItemResponse,
} from './student-review-item.response.js';
import { StudentReviewService } from './student-review.service.js';

/**
 * Student status review for administrators, reached through the gateway at
 * /api/identity/admin/students. Every route answers 403 to a student.
 */
@ApiTags('admin')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'The caller is not an administrator.' })
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/students')
export class StudentReviewController {
  constructor(private readonly review: StudentReviewService) {}

  @Get()
  @ApiOkResponse({ type: StudentQueueResponse })
  queue(@Query() query: StudentQueueQuery): Promise<StudentQueueResponse> {
    return this.review.queue(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StudentReviewItemResponse })
  @ApiConflictResponse({ description: 'The student is not PENDING.' })
  approve(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @CorrelationId() correlationId: string,
  ): Promise<StudentReviewItemResponse> {
    return this.review.approve(admin, id, correlationId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StudentReviewItemResponse })
  @ApiConflictResponse({ description: 'The student is not PENDING.' })
  reject(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectStudentDto,
    @CorrelationId() correlationId: string,
  ): Promise<StudentReviewItemResponse> {
    return this.review.reject(admin, id, dto.reason, correlationId);
  }
}
