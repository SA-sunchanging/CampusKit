import { postgresOptions } from '@app/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity.js';
import { migrations } from '../migrations/index.js';
import { PasswordsModule } from '../passwords/passwords.module.js';

/** Only what the seed needs: the database (migrations run first) and the password hasher. */
@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('identity', migrations)),
    TypeOrmModule.forFeature([Account]),
    PasswordsModule,
  ],
})
export class SeedModule {}
