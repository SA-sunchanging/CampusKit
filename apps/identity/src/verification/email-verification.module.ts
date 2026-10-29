import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { EmailVerificationController } from './email-verification.controller.js';
import { EmailVerification } from './email-verification.entity.js';
import { EmailVerificationService } from './email-verification.service.js';
import { VerificationSettings } from './verification-code.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailVerification]),
    AccountsModule,
    AuthModule,
  ],
  controllers: [EmailVerificationController],
  providers: [
    EmailVerificationService,
    {
      provide: VerificationSettings,
      useFactory: () => VerificationSettings.fromEnv(),
    },
  ],
})
export class EmailVerificationModule {}
