import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DeadLetterQueriesService } from './dead-letter-queries.service.js';
import { DeadLetterListResponse } from './dead-letter.response.js';
import { DeadLettersQuery } from './dto/dead-letters.query.js';

/**
 * Administrator view of the events the inbox consumer dead-lettered, reached through the gateway
 * at /api/notification/admin/dead-letters. Read-only; a student gets 403.
 */
@ApiTags('dead-letters')
@Controller('admin/dead-letters')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeadLettersController {
  constructor(private readonly queries: DeadLetterQueriesService) {}

  @Get()
  @ApiOkResponse({ type: DeadLetterListResponse })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: DeadLettersQuery,
  ): Promise<DeadLetterListResponse> {
    return this.queries.list(user, query);
  }
}
