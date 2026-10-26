import { AuthModule as JwtAuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { PasswordsModule } from '../passwords/passwords.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/** Logs users in. Shares the JWT secret and verifier with every service through @app/common. */
@Module({
  imports: [AccountsModule, PasswordsModule, JwtAuthModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
