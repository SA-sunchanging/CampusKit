import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Profile } from '../accounts/profile.js';
import { ConfirmEmailDto } from './dto/confirm-email.dto.js';
import { EmailCodeResponse } from './email-code.response.js';
import { EmailVerificationService } from './email-verification.service.js';

/** Email verification of the caller's account, at /api/identity/accounts/me/email-verification. */
@ApiTags('accounts')
@ApiBearerAuth()
@ApiConflictResponse({ description: 'The email is already verified.' })
@UseGuards(JwtAuthGuard)
@Controller('accounts/me/email-verification')
export class EmailVerificationController {
  constructor(private readonly verification: EmailVerificationService) {}

  @Post()
  @ApiCreatedResponse({ type: EmailCodeResponse })
  @ApiTooManyRequestsResponse({
    description: 'A code was issued less than a minute ago.',
  })
  issue(@CurrentUser() user: AuthUser): Promise<EmailCodeResponse> {
    return this.verification.issue(user.sub);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: Profile })
  @ApiGoneResponse({
    description: 'No code, or it expired or was used up; ask for a new one.',
  })
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmEmailDto,
  ): Promise<Profile> {
    return this.verification.confirm(user.sub, dto.code);
  }
}
