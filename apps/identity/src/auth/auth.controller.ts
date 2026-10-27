import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AccessToken } from './access-token.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

/** Reached through the gateway at /api/identity/auth. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AccessToken })
  login(@Body() dto: LoginDto): Promise<AccessToken> {
    return this.auth.login(dto);
  }
}
