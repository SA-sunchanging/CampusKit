import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const BOOKING_STATUSES = [
  'PENDING',
  'AUTHORIZING',
  'CONFIRMED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that still hold a reservation and count toward a renter's open requests. */
export const OPEN_STATUSES: readonly BookingStatus[] = [
  'PENDING',
  'AUTHORIZING',
];

/**
 * A renter's request for a listing period, with the terms quoted when it was made.
 * The schema is defined by the migrations, not by this class.
 */
@Entity('bookings')
export class Booking {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'listing_id' })
  listingId: string;

  @Column('uuid', { name: 'renter_id' })
  renterId: string;

  @Column('uuid', { name: 'owner_id' })
  ownerId: string;

  @Column('text')
  status: BookingStatus;

  /** Half-open range [start, end) as PostgreSQL text. */
  @Column('tstzrange')
  period: string;

  /** Integer satang, as in the proto Terms. */
  @Column('integer', { name: 'rental_fee' })
  rentalFee: number;

  @Column('integer')
  deposit: number;

  @Column('integer', { name: 'late_fee_per_day' })
  lateFeePerDay: number;

  @Column('text', { name: 'decline_reason', nullable: true })
  declineReason: string | null;

  /** Why the last approval attempt did not confirm the booking; for logs and support. */
  @Column('text', { name: 'last_error', nullable: true })
  lastError: string | null;

  @Column('text', { name: 'rental_id', nullable: true })
  rentalId: string | null;

  /** A PENDING request expires at this time if the owner does not answer. */
  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
