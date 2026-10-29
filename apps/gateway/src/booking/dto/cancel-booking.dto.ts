import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_CANCEL_REASON = 200;

/** Body of POST /api/booking/bookings/{id}/cancel. */
export class CancelBookingDto {
  @ApiPropertyOptional({
    maxLength: MAX_CANCEL_REASON,
    description: 'Shown to the other participant.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_CANCEL_REASON)
  reason?: string;
}
