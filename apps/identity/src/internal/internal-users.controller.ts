import {
  InternalAuthGuard,
  InternalCallers,
  SERVICE_TOKEN_HEADER,
} from '@app/common';
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccountsService } from '../accounts/accounts.service.js';
import { EligibilityResponse } from '../eligibility/eligibility.response.js';
import { UserProfileResponse } from './user-profile.response.js';

/**
 * Service-to-service lookups for Listing and Booking. The gateway does not forward /internal
 * paths, and each route accepts only the service tokens of its callers
 * (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).
 */
@ApiTags('internal')
@ApiHeader({ name: SERVICE_TOKEN_HEADER, required: true })
@UseGuards(InternalAuthGuard)
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':id/eligibility')
  @InternalCallers('booking', 'listing')
  @ApiOkResponse({ type: EligibilityResponse })
  eligibility(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EligibilityResponse> {
    return this.accounts.getEligibility(id);
  }

  @Get(':id/profile')
  @InternalCallers('listing')
  @ApiOkResponse({ type: UserProfileResponse })
  profile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserProfileResponse> {
    return this.accounts.getUserProfile(id);
  }
}
