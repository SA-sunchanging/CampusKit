import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { PaymentsModule } from './payments/payments.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('payment', migrations)),
    AuthModule,
    HealthModule.register('payment'),
    PaymentsModule,
  ],
})
export class PaymentModule {}
