import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Statuses stored in rentals.status, in the order a rental moves through them:
 * AWAITING_PICKUP until the renter confirms pickup with the owner's code, ACTIVE until the owner
 * confirms the return with the renter's code, SETTLEMENT_PENDING while Payment settles the
 * deposit and late fee, and CLOSED once it has. CANCELLED ends a rental whose booking was
 * cancelled while it was still AWAITING_PICKUP.
 */
export const RENTAL_STATUSES = [
  'AWAITING_PICKUP',
  'ACTIVE',
  'SETTLEMENT_PENDING',
  'CLOSED',
  'CANCELLED',
] as const;

export type RentalStatus = (typeof RENTAL_STATUSES)[number];

/**
 * The handover of one confirmed booking, with the people, period and terms of the booking.
 * The schema is defined by the migrations, not by this class.
 */
@Entity('rentals')
export class Rental {
  @PrimaryColumn('uuid')
  id: string;

  /** One rental per booking. */
  @Column('uuid', { name: 'booking_id' })
  bookingId: string;

  @Column('uuid', { name: 'listing_id' })
  listingId: string;

  @Column('uuid', { name: 'owner_id' })
  ownerId: string;

  @Column('uuid', { name: 'renter_id' })
  renterId: string;

  /** The booked period is the half-open range [periodStart, periodEnd). */
  @Column('timestamptz', { name: 'period_start' })
  periodStart: Date;

  @Column('timestamptz', { name: 'period_end' })
  periodEnd: Date;

  /** Integer satang, as in the booking's terms. */
  @Column('integer', { name: 'rental_fee' })
  rentalFee: number;

  @Column('integer')
  deposit: number;

  @Column('integer', { name: 'late_fee_per_day' })
  lateFeePerDay: number;

  @Column('text')
  status: RentalStatus;

  /** Six digits held by the owner; the renter enters it at pickup. */
  @Column('text', { name: 'pickup_code' })
  pickupCode: string;

  /** Six digits held by the renter; the owner enters it at the return. */
  @Column('text', { name: 'return_code' })
  returnCode: string;

  /** Wrong pickup codes entered since the code was made. */
  @Column('integer', { name: 'pickup_attempts' })
  pickupAttempts: number;

  /** Wrong return codes entered since the code was made. */
  @Column('integer', { name: 'return_attempts' })
  returnAttempts: number;

  @Column('timestamptz', { name: 'picked_up_at', nullable: true })
  pickedUpAt: Date | null;

  @Column('timestamptz', { name: 'returned_at', nullable: true })
  returnedAt: Date | null;

  @Column('timestamptz', { name: 'closed_at', nullable: true })
  closedAt: Date | null;

  /** Whole days late, stored once when the return is accepted. */
  @Column('integer', { name: 'late_days' })
  lateDays: number;

  /** Satang, stored with late_days. */
  @Column('integer', { name: 'late_fee' })
  lateFee: number;

  /** Why the last settlement attempt failed; for the owner's retry and for support. */
  @Column('text', { name: 'last_error', nullable: true })
  lastError: string | null;

  /**
   * When a pickup claimed the rental before capturing the fee; a cancellation waits until the
   * pickup ends or the claim is older than its lease. Null when no pickup is running.
   */
  @Column('timestamptz', { name: 'pickup_claimed_at', nullable: true })
  pickupClaimedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
