import { ApiProperty } from '@nestjs/swagger';
import {
  type Eligibility,
  ELIGIBILITY_REASONS,
  type EligibilityReason,
} from './eligibility.js';

/** Body of GET /internal/users/{id}/eligibility. */
export class EligibilityResponse {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'True when reasons is empty.' })
  canPublish: boolean;

  @ApiProperty({
    description:
      'True when reasons is empty or holds only PAYOUT_PROFILE_MISSING.',
  })
  canBook: boolean;

  @ApiProperty({
    enum: ELIGIBILITY_REASONS,
    enumName: 'EligibilityReason',
    isArray: true,
    description:
      'Every failing rule, in this fixed order. PAYOUT_PROFILE_MISSING blocks only publishing; every other reason blocks publishing and booking.',
  })
  reasons: EligibilityReason[];

  static of(userId: string, eligibility: Eligibility): EligibilityResponse {
    return Object.assign(new EligibilityResponse(), {
      userId,
      ...eligibility,
    });
  }
}
