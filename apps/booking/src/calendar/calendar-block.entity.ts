import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type BlockKind = 'BLACKOUT' | 'RESERVATION';

/**
 * One blocked period of a listing: an owner blackout or a booking reservation.
 * A block stops counting once released_at is set. The schema is defined by the migrations.
 */
@Entity('calendar_blocks')
export class CalendarBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'listing_id' })
  listingId: string;

  /** Half-open range [start, end) as PostgreSQL text, for example ["2026-11-01 17:00:00+00","2026-11-03 17:00:00+00"). */
  @Column('tstzrange')
  period: string;

  @Column('text')
  kind: BlockKind;

  @Column('uuid', { name: 'booking_id', nullable: true })
  bookingId: string | null;

  @Column('timestamptz', { name: 'released_at', nullable: true })
  releasedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
