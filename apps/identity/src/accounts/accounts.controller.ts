import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service.js';
import { PayoutProfileDto } from './dto/payout-profile.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { PayoutProfile } from './payout-profile.js';
import { Profile } from './profile.js';

/**
 * REST endpoints of the identity service, reached through the gateway at /api/identity/accounts.
 * Operations owned by this service (see docs/architecture/services.md): register, login (issue JWT), verify email, administrator student review, eligibility and profile lookup.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post()
  @ApiCreatedResponse({ type: Profile })
  register(@Body() dto: RegisterDto): Promise<Profile> {
    return this.accounts.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: Profile })
  me(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.accounts.getProfile(user.sub);
  }

  @Put('me/payout-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: PayoutProfile })
  setPayoutProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: PayoutProfileDto,
  ): Promise<PayoutProfile> {
    return this.accounts.setPayoutProfile(user.sub, dto);
  }
}
