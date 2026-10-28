import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** The calendar of one listing. The schema is defined by the migrations, not by this class. */
@Entity('calendars')
export class Calendar {
  @PrimaryColumn('uuid', { name: 'listing_id' })
  listingId: string;

  /** The user who set the calendar up first; only this user may change the blackouts. */
  @Column('uuid', { name: 'owner_id' })
  ownerId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
