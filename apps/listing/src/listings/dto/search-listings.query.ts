import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  type ValidationArguments,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import {
  CATEGORIES,
  type Category,
  MAX_RENTAL_DAYS,
  PICKUP_LOCATIONS,
  type PickupLocation,
} from '../listing-options.js';

export const MAX_PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

/** The search period ends after it starts and lasts at most the longest rental. */
@ValidatorConstraint({ name: 'searchPeriod' })
class SearchPeriodRule implements ValidatorConstraintInterface {
  validate(end: string, args: ValidationArguments): boolean {
    const { start } = args.object as SearchListingsQuery;
    const length = Date.parse(end) - Date.parse(start ?? '');
    return length > 0 && length <= MAX_RENTAL_DAYS * DAY_MS;
  }

  defaultMessage(): string {
    return `end must be after start and at most ${MAX_RENTAL_DAYS} days later`;
  }
}

/** True when the query names a period; then both ends are required. */
const hasPeriod = (query: SearchListingsQuery) =>
  query.start !== undefined || query.end !== undefined;

/** Query of GET /listings. Empty values mean "any". */
export class SearchListingsQuery {
  @ApiPropertyOptional({ description: 'Words in the title or description.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(CATEGORIES)
  category?: Category;

  @ApiPropertyOptional({
    enum: PICKUP_LOCATIONS,
    description: 'Only listings with this pickup point.',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn(PICKUP_LOCATIONS)
  location?: PickupLocation;

  @ApiPropertyOptional({
    example: '2026-11-01T17:00:00Z',
    description:
      'With end: only listings free for the whole half-open period [start, end). Give both or neither.',
  })
  @Transform(emptyToUndefined)
  @ValidateIf(hasPeriod)
  @IsISO8601({ strict: true })
  start?: string;

  @ApiPropertyOptional({
    example: '2026-11-04T17:00:00Z',
    description: `After start, at most ${MAX_RENTAL_DAYS} days later.`,
  })
  @Transform(emptyToUndefined)
  @ValidateIf(hasPeriod)
  @IsISO8601({ strict: true })
  @Validate(SearchPeriodRule)
  end?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}
