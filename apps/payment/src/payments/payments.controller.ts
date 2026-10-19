import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the payment service, reached through the gateway at /api/payment/payments.
 * Operations owned by this service (see docs/architecture/services.md): payment method, fee and deposit authorization, capture, void and refund, late-fee settlement, payout.
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
