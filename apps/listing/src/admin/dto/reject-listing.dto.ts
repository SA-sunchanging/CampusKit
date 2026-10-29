import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Body of POST /admin/listings/:id/reject. The owner reads the reason in their inbox. */
export class RejectListingDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 300,
    example: 'Weapons cannot be rented on campus.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 300)
  reason: string;
}
