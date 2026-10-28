import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  Category,
  Condition,
  ListingStatus,
  PickupLocation,
} from './listing-options.js';

/** A half-open period [start, end), ISO-8601 UTC. */
export interface Blackout {
  start: string;
  end: string;
}

/** An item a student offers for rent. The schema is defined by the migrations, not by this class. */
@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'owner_id' })
  ownerId: string;

  /** Display name copied from Identity when the listing is created, so search needs no extra call. */
  @Column('text', { name: 'owner_name' })
  ownerName: string;

  @Column('text')
  status: ListingStatus;

  @Column('text')
  title: string;

  @Column('text')
  category: Category;

  @Column('text')
  description: string;

  @Column('text')
  condition: Condition;

  @Column('text', { array: true })
  accessories: string[];

  @Column('integer', { name: 'replacement_value' })
  replacementValue: number;

  @Column('integer', { name: 'daily_rate' })
  dailyRate: number;

  @Column('integer')
  deposit: number;

  @Column('integer', { name: 'late_fee_per_day' })
  lateFeePerDay: number;

  @Column('integer', { name: 'max_rental_days' })
  maxRentalDays: number;

  @Column('text', { name: 'pickup_locations', array: true })
  pickupLocations: PickupLocation[];

  /** Kept so a failed calendar setup can be retried with the same dates. */
  @Column('jsonb')
  blackouts: Blackout[];

  @Column('text', { nullable: true })
  thumbnail: string | null;

  /** Why the last publish attempt failed; null once published. */
  @Column('text', { name: 'publish_error', nullable: true })
  publishError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column('timestamptz', { name: 'published_at', nullable: true })
  publishedAt: Date | null;
}
