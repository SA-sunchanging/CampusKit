import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { HealthModule, postgresOptions } from '@app/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('identity', migrations)),
    HealthModule.register('identity'),
    AccountsModule,
    AuthModule,
  ],
})
export class IdentityModule {}
