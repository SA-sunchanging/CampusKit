import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordsModule } from '../passwords/passwords.module.js';
import { Account } from './account.entity.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Account]), PasswordsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
