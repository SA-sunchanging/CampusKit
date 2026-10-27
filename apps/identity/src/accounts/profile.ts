import { ApiProperty } from '@nestjs/swagger';
import type { Account, Role, StudentStatus } from './account.entity.js';

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

  @ApiProperty({ enum: ['UNSUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'] })
  studentStatus: StudentStatus;

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
    createdAt: account.createdAt,
  });
}
