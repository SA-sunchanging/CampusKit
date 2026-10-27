import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';

export class PayoutProfileDto {
  @ApiProperty({ enum: ['PROMPTPAY'] })
  @IsIn(['PROMPTPAY'])
  method: 'PROMPTPAY';

  @ApiProperty({
    description:
      'Digits only: a 10-digit mobile number starting with 0, or a 13-digit national ID.',
    example: '0812345678',
  })
  @IsString()
  @Matches(/^(0\d{9}|\d{13})$/, {
    message:
      'promptPayId must be a 10-digit mobile number starting with 0 or a 13-digit national ID',
  })
  promptPayId: string;

  @ApiProperty({ minLength: 1, maxLength: 100, example: 'Somchai Jaidee' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  accountName: string;
}
