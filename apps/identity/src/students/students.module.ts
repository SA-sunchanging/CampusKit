import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { StudentReviewController } from './student-review.controller.js';
import { StudentReviewService } from './student-review.service.js';
import { StudentStatusController } from './student-status.controller.js';
import { StudentStatusService } from './student-status.service.js';

/** Student verification: the student submits a student ID, an administrator reviews it. */
@Module({
  imports: [TypeOrmModule.forFeature([Account]), AccountsModule, AuthModule],
  controllers: [StudentStatusController, StudentReviewController],
  providers: [StudentStatusService, StudentReviewService],
})
export class StudentsModule {}
