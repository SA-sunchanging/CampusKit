import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/** Body of POST /accounts/me/email-verification/confirm. */
export class ConfirmEmailDto {
  @ApiProperty({ pattern: '^\\d{6}$', example: '042917' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code: string;
}
