import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_DECLINE_REASON = 500;

/** Body of POST /api/booking/bookings/{id}/decline. */
export class DeclineBookingDto {
  @ApiPropertyOptional({
    maxLength: MAX_DECLINE_REASON,
    description: 'Shown to the renter.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_DECLINE_REASON)
  reason?: string;
}
