import { AuthModule } from '@app/common';
import { Module } from '@nestjs/common';
import { InternalPaymentsController } from '../internal/internal-payments.controller.js';
import { AuthorizeService } from '../ledger/authorize.js';
import { CaptureService } from '../ledger/capture.js';
import { SettleService } from '../ledger/settle.js';
import { VoidService } from '../ledger/void.js';
import { PaymentStatusService } from './payment-status.service.js';
import { PaymentsController } from './payments.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController, InternalPaymentsController],
  providers: [
    AuthorizeService,
    CaptureService,
    VoidService,
    SettleService,
    PaymentStatusService,
  ],
})
export class PaymentsModule {}
