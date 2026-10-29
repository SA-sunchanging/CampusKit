import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { HealthModule, postgresOptions } from '@app/common';
import { OutboxModule } from '@app/messaging';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { InternalUsersModule } from './internal/internal-users.module.js';
import { migrations } from './migrations/index.js';
import { EmailVerificationModule } from './verification/email-verification.module.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('identity', migrations)),
    HealthModule.register('identity'),
    AccountsModule,
    AuthModule,
    InternalUsersModule,
    EmailVerificationModule,
    OutboxModule,
  ],
})
export class IdentityModule {}
