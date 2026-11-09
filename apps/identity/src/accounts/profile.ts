import { ApiProperty } from '@nestjs/swagger';
import {
  type Account,
  type Role,
  STUDENT_STATUSES,
  type StudentStatus,
} from './account.entity.js';
import { PayoutProfile } from './payout-profile.js';

/** What an account looks like to its owner. Never includes the password hash. */
export class Profile {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'somchai@student.chula.ac.th' })
  email: string;

  @ApiProperty({ example: 'Somchai' })
  displayName: string;

  @ApiProperty({ enum: ['student', 'admin'] })
  role: Role;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({ enum: STUDENT_STATUSES })
  studentStatus: StudentStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The student ID submitted for review.',
  })
  studentId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: "The administrator's reason. Set only on a REJECTED status.",
  })
  studentRejectionReason: string | null;

  @ApiProperty({ type: PayoutProfile, nullable: true })
  payoutProfile: PayoutProfile | null;

  @ApiProperty()
  createdAt: Date;
}

export function toProfile(account: Account): Profile {
  return Object.assign(new Profile(), {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    emailVerified: account.emailVerifiedAt !== null,
    studentStatus: account.studentStatus,
    studentId: account.studentId,
    studentRejectionReason: account.studentRejectionReason,
    payoutProfile: account.payoutProfile,
    createdAt: account.createdAt,
  });
}
