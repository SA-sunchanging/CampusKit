import { Module } from '@nestjs/common';
import { AccountsModule } from './accounts/accounts.module.js';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('identity', migrations)),
    AuthModule,
    HealthModule.register('identity'),
    AccountsModule,
  ],
})
export class IdentityModule {}
