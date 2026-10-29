import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const RENTAL_ROLES = ['renter', 'owner'] as const;

export type RentalRole = (typeof RENTAL_ROLES)[number];

/** Query of GET /rentals. */
export class ListRentalsQuery {
  @ApiProperty({
    enum: RENTAL_ROLES,
    description:
      "renter: the caller's own rentals; owner: rentals of the caller's listings.",
  })
  @IsIn(RENTAL_ROLES)
  role: RentalRole;
}
