import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const AUTHORIZATION_KINDS = ['FEE', 'DEPOSIT'] as const;

export type AuthorizationKind = (typeof AUTHORIZATION_KINDS)[number];

/** Statuses stored in authorizations.status. */
export const AUTHORIZATION_STATUSES = [
  'AUTHORIZED',
  'CAPTURED',
  'SETTLED',
  'VOIDED',
] as const;

export type AuthorizationStatus = (typeof AUTHORIZATION_STATUSES)[number];

/** What callers see: an AUTHORIZED row past expires_at is reported as EXPIRED. */
export type ReportedStatus = AuthorizationStatus | 'EXPIRED';

/**
 * A hold on the renter's money for one booking: the rental fee (FEE) or the deposit (DEPOSIT).
 * The fee is captured at pickup; the deposit is split at settlement into the late fee taken
 * (captured_amount) and the rest given back (released_amount).
 * The schema is defined by the migrations, not by this class.
 */
@Entity('authorizations')
export class Authorization {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'booking_id' })
  bookingId: string;

  @Column('text')
  kind: AuthorizationKind;

  /** The renter. */
  @Column('uuid', { name: 'payer_id' })
  payerId: string;

  /** The listing owner. */
  @Column('uuid', { name: 'payee_id' })
  payeeId: string;

  /** Integer satang. */
  @Column('integer')
  amount: number;

  @Column('integer', { name: 'captured_amount' })
  capturedAmount: number;

  @Column('integer', { name: 'released_amount' })
  releasedAmount: number;

  @Column('text')
  status: AuthorizationStatus;

  /** An AUTHORIZED hold can no longer be captured or settled from this time. */
  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
