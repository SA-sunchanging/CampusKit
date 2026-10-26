import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AccessToken, AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

/** Reached through the gateway at /api/identity/auth. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AccessToken> {
    return this.auth.login(dto);
  }
}
