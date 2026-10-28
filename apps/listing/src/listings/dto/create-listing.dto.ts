import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CATEGORIES,
  type Category,
  CONDITIONS,
  type Condition,
  MAX_AMOUNT,
  MAX_DAILY_RATE,
  MAX_PHOTOS,
  MAX_RENTAL_DAYS,
  PICKUP_LOCATIONS,
  type PickupLocation,
} from '../listing-options.js';
import { IMAGE_DATA_URL } from '../photos.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** A half-open period [start, end), ISO-8601 UTC. Both ends are midnight in Bangkok. */
export class DateRangeDto {
  @ApiProperty({ example: '2026-11-01T17:00:00Z' })
  @IsISO8601({ strict: true })
  start: string;

  @ApiProperty({ example: '2026-11-03T17:00:00Z' })
  @IsISO8601({ strict: true })
  end: string;
}

/** Body of POST /listings. Money is integer satang (1 THB = 100 satang). */
export class CreateListingDto {
  @ApiProperty({ example: 'Calculus I textbook, 8th edition' })
  @Transform(trim)
  @IsString()
  @Length(3, 100)
  title: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category: Category;

  @ApiProperty({ example: 'Clean copy with a few pencil notes.' })
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  description: string;

  @ApiProperty({ enum: CONDITIONS })
  @IsIn(CONDITIONS)
  condition: Condition;

  @ApiProperty({ type: [String], example: ['Solution manual'] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  accessories: string[];

  @ApiProperty({ description: 'Satang.', example: 120000 })
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  replacementValue: number;

  @ApiProperty({ description: 'Satang per day.', example: 2000 })
  @IsInt()
  @Min(1)
  @Max(MAX_DAILY_RATE)
  dailyRate: number;

  @ApiProperty({ description: 'Satang.', example: 30000 })
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  deposit: number;

  @ApiProperty({ description: 'Satang per day late.', example: 4000 })
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT)
  lateFeePerDay: number;

  @ApiProperty({ minimum: 1, maximum: MAX_RENTAL_DAYS, example: 7 })
  @IsInt()
  @Min(1)
  @Max(MAX_RENTAL_DAYS)
  maxRentalDays: number;

  @ApiProperty({ enum: PICKUP_LOCATIONS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(PICKUP_LOCATIONS, { each: true })
  pickupLocations: PickupLocation[];

  @ApiProperty({
    type: [DateRangeDto],
    description: 'Dates the owner does not rent the item out; at most 10.',
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DateRangeDto)
  blackouts: DateRangeDto[];

  @ApiProperty({
    type: [String],
    description:
      'Compressed JPEG, PNG, or WebP data URLs, at most 400 KB each. The first is the cover.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PHOTOS)
  @Matches(IMAGE_DATA_URL, {
    each: true,
    message: 'each photo must be a JPEG, PNG, or WebP data URL',
  })
  photos: string[];

  @ApiProperty({
    description: 'Small data URL of the cover, at most 60 KB, shown in search.',
  })
  @Matches(IMAGE_DATA_URL, {
    message: 'thumbnail must be a JPEG, PNG, or WebP data URL',
  })
  thumbnail: string;
}
