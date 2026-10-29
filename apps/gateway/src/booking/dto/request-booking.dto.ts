import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsUUID, ValidateNested } from 'class-validator';
import { DateRangeDto } from './date-range.dto.js';

/** Body of POST /api/booking/bookings: the renter asks for a period of a listing. */
export class RequestBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId: string;

  @ApiProperty({
    type: DateRangeDto,
    description: 'Both ends are midnight in Bangkok.',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => DateRangeDto)
  period: DateRangeDto;
}
