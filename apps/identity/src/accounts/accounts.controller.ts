import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the identity service, reached through the gateway at /api/identity/accounts.
 * Operations owned by this service (see docs/architecture/services.md): register, login (issue JWT), verify email, administrator student review, eligibility and profile lookup.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
