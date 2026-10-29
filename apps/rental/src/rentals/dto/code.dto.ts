import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of POST /rentals/{id}/pickup: the owner's code, entered by the renter. */
export class CodeDto {
  @ApiProperty({
    description:
      'The six-digit pickup code. A wrong code counts as an attempt; the fifth wrong attempt replaces the code.',
    example: '012345',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

/** Body of POST /rentals/{id}/return: the renter's code, entered by the owner. */
export class ReturnDto {
  @ApiProperty({
    required: false,
    description:
      'The six-digit return code; required while ACTIVE, ignored when retrying a SETTLEMENT_PENDING rental. A wrong code counts as an attempt; the fifth wrong attempt replaces the code.',
    example: '987654',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}
