import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { RegisterDto } from './dto/register.dto.js';
import type { Profile } from './profile.js';

/**
 * REST endpoints of the identity service, reached through the gateway at /api/identity/accounts.
 * Operations owned by this service (see docs/architecture/services.md): register, login (issue JWT), verify email, administrator student review, eligibility and profile lookup.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  register(@Body() dto: RegisterDto): Promise<Profile> {
    return this.accounts.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.accounts.getProfile(user.sub);
  }
}
