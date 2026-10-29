import type { AuthUser } from '@app/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PayoutProfile } from './payout-profile.js';

export type Role = AuthUser['role'];

/**
 * UNSUBMITTED until the student submits a student ID (PENDING); an administrator then approves
 * (VERIFIED) or rejects it (REJECTED, which the student may submit again).
 */
export const STUDENT_STATUSES = [
  'UNSUBMITTED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

/** A CampusKit user. The schema is defined by the migrations, not by this class. */
@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  email: string;

  @Column('text', { name: 'password_hash' })
  passwordHash: string;

  @Column('text', { name: 'display_name' })
  displayName: string;

  @Column('text')
  role: Role;

  @Column('timestamptz', { name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | null;

  @Column('text', { name: 'student_status' })
  studentStatus: StudentStatus;

  /** The 10-digit Chula student ID the student submitted for review. */
  @Column('text', { name: 'student_id', nullable: true })
  studentId: string | null;

  @Column('timestamptz', { name: 'student_submitted_at', nullable: true })
  studentSubmittedAt: Date | null;

  /** The administrator who approved or rejected the student status. */
  @Column('uuid', { name: 'student_reviewed_by', nullable: true })
  studentReviewedBy: string | null;

  @Column('timestamptz', { name: 'student_reviewed_at', nullable: true })
  studentReviewedAt: Date | null;

  /** Set only on a REJECTED student status; the student reads it on the account page. */
  @Column('text', { name: 'student_rejection_reason', nullable: true })
  studentRejectionReason: string | null;

  @Column('jsonb', { name: 'payout_profile', nullable: true })
  payoutProfile: PayoutProfile | null;

  @Column('timestamptz', { name: 'suspended_at', nullable: true })
  suspendedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
