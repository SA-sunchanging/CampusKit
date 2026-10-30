import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EvidenceListResponse, EvidenceResponse } from './evidence.response.js';
import { EvidenceService } from './evidence.service.js';
import { RecordEvidenceDto } from './record-evidence.dto.js';

/**
 * Condition evidence of a rental, reached through the gateway at /api/rental/rentals/{id}/evidence.
 * Only the renter and the owner record and read it.
 */
@ApiTags('rentals')
@Controller('rentals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  /** PICKUP while AWAITING_PICKUP, RETURN while ACTIVE; once per party and stage, else 409. */
  @Post(':id/evidence')
  @ApiCreatedResponse({ type: EvidenceResponse })
  record(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordEvidenceDto,
  ): Promise<EvidenceResponse> {
    return this.evidence.record(user, id, dto);
  }

  @Get(':id/evidence')
  @ApiOkResponse({ type: EvidenceListResponse })
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EvidenceListResponse> {
    return this.evidence.list(user, id);
  }
}
