import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export const MAX_USER_IDS = 50;

/** Query of GET /internal/reputation. */
export class ReputationQuery {
  @ApiProperty({
    type: String,
    description: `Comma-separated user UUIDs, at most ${MAX_USER_IDS}.`,
    example:
      '22222222-2222-4222-8222-222222222222,33333333-3333-4333-8333-333333333333',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id !== '')
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_USER_IDS)
  @IsUUID('all', { each: true })
  userIds: string[];
}
