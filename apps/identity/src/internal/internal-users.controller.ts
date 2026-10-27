import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountsService } from '../accounts/accounts.service.js';
import { EligibilityResponse } from '../eligibility/eligibility.response.js';

/**
 * Service-to-service lookups for Listing and Booking. The gateway does not forward /internal paths.
 * Internal service authentication is still open (docs/architecture/services.md).
 */
@ApiTags('internal')
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly accounts: AccountsService) {}

  @Get(':id/eligibility')
  eligibility(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EligibilityResponse> {
    return this.accounts.getEligibility(id);
  }
}
