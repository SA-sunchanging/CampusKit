import { ApiProperty } from '@nestjs/swagger';
import type { Account } from '../accounts/account.entity.js';
import { PayoutProfile } from '../accounts/payout-profile.js';

/** Body of GET /internal/users/{id}/profile. Never includes the email or password hash. */
export class UserProfileResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: PayoutProfile, nullable: true })
  payoutProfile: PayoutProfile | null;

  static of(account: Account): UserProfileResponse {
    return Object.assign(new UserProfileResponse(), {
      id: account.id,
      displayName: account.displayName,
      payoutProfile: account.payoutProfile,
    });
  }
}
