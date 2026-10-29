import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
