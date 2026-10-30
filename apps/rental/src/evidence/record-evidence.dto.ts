import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  CONDITIONS,
  type Condition,
  EVIDENCE_STAGES,
  type EvidenceStage,
  IMAGE_DATA_URL,
  MAX_ACCESSORIES,
  MAX_ACCESSORY_LENGTH,
  MAX_EVIDENCE_PHOTOS,
  MAX_NOTE_LENGTH,
} from './evidence-options.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

/** Body of POST /rentals/{id}/evidence: what one party saw at pickup or at the return. */
export class RecordEvidenceDto {
  @ApiProperty({
    enum: EVIDENCE_STAGES,
    description: 'PICKUP while AWAITING_PICKUP; RETURN while ACTIVE.',
  })
  @IsIn(EVIDENCE_STAGES)
  stage: EvidenceStage;

  @ApiProperty({
    enum: CONDITIONS,
    description: 'The listing condition codes.',
  })
  @IsIn(CONDITIONS)
  condition: Condition;

  @ApiProperty({
    type: [String],
    description: `The accessories handed over; at most ${MAX_ACCESSORIES}.`,
    example: ['Charger', 'Case'],
  })
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(MAX_ACCESSORIES)
  @IsString({ each: true })
  @Length(1, MAX_ACCESSORY_LENGTH, { each: true })
  accessories: string[];

  @ApiProperty({
    type: [String],
    description: `Compressed JPEG, PNG, or WebP data URLs, at most 400 KB each; at most ${MAX_EVIDENCE_PHOTOS}.`,
  })
  @IsArray()
  @ArrayMaxSize(MAX_EVIDENCE_PHOTOS)
  @Matches(IMAGE_DATA_URL, {
    each: true,
    message: 'each photo must be a JPEG, PNG, or WebP data URL',
  })
  photos: string[];

  @ApiProperty({ required: false, example: 'Small scratch on the lid.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  note?: string;
}
