import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { InternalUsersController } from './internal-users.controller.js';

@Module({
  imports: [AccountsModule],
  controllers: [InternalUsersController],
})
export class InternalUsersModule {}
