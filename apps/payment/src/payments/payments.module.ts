import { Module } from '@nestjs/common';
import { InternalPaymentsController } from '../internal/internal-payments.controller.js';
import { AuthorizeService } from '../ledger/authorize.js';
import { CaptureService } from '../ledger/capture.js';
import { VoidService } from '../ledger/void.js';
import { PaymentsController } from './payments.controller.js';

@Module({
  controllers: [PaymentsController, InternalPaymentsController],
  providers: [AuthorizeService, CaptureService, VoidService],
})
export class PaymentsModule {}
