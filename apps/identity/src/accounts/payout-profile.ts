import { ApiProperty } from '@nestjs/swagger';

/** Where a student's rental income is paid. PromptPay only for now; `method` leaves room for others. */
export class PayoutProfile {
  @ApiProperty({ enum: ['PROMPTPAY'] })
  method: 'PROMPTPAY';

  @ApiProperty({
    description:
      'A 10-digit mobile number starting with 0, or a 13-digit national ID.',
    example: '0812345678',
  })
  promptPayId: string;

  @ApiProperty({ example: 'Somchai Jaidee' })
  accountName: string;
}
