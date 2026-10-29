import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_COMMENT_LENGTH = 500;

/** Body of POST /reviews. */
export class SubmitReviewDto {
  @ApiProperty({
    format: 'uuid',
    description: 'A CLOSED rental of the caller.',
  })
  @IsUUID()
  rentalId: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: 'Whole stars.' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: MAX_COMMENT_LENGTH })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  comment?: string;
}
