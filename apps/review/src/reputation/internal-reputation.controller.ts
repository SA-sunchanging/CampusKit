import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ReputationQuery } from './dto/reputation.query.js';
import {
  ReputationListResponse,
  ReputationResponse,
} from './reputation.response.js';
import { ReputationService } from './reputation.service.js';

/**
 * Service-to-service endpoints for Listing. The gateway does not forward /internal paths.
 * Internal service authentication is still open (docs/architecture/services.md).
 */
@ApiTags('internal')
@Controller('internal')
export class InternalReputationController {
  constructor(private readonly reputation: ReputationService) {}

  @Get('users/:id/reputation')
  @ApiOkResponse({ type: ReputationResponse })
  one(@Param('id', ParseUUIDPipe) id: string): Promise<ReputationResponse> {
    return this.reputation.summary(id);
  }

  /** Several users at once, for a page of listings. */
  @Get('reputation')
  @ApiOkResponse({ type: ReputationListResponse })
  async many(@Query() query: ReputationQuery): Promise<ReputationListResponse> {
    return { items: await this.reputation.summaries(query.userIds) };
  }
}
