import type { AuthUser } from '@app/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type Role = AuthUser['role'];

export type StudentStatus = 'UNSUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

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

  @Column('jsonb', { name: 'payout_profile', nullable: true })
  payoutProfile: Record<string, unknown> | null;

  @Column('timestamptz', { name: 'suspended_at', nullable: true })
  suspendedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
