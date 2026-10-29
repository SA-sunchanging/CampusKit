import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import {
  BOOKING_ROLES,
  BOOKING_STATUSES,
  type BookingRole,
  type BookingStatus,
} from '../booking-status.js';

/** Query of GET /api/booking/bookings. An empty status means any. */
export class ListBookingsQuery {
  @ApiProperty({
    enum: BOOKING_ROLES,
    description:
      "renter: the caller's own requests; owner: requests on the caller's listings.",
  })
  @IsIn(BOOKING_ROLES)
  role: BookingRole;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @IsIn(BOOKING_STATUSES)
  status?: BookingStatus;
}
