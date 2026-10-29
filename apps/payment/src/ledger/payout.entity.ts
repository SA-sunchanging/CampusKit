import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * What the listing owner receives when a rental is settled: the captured fee plus the late fee
 * taken from the deposit. One per booking. The schema is defined by the migrations.
 */
@Entity('payouts')
export class Payout {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'booking_id', unique: true })
  bookingId: string;

  @Column('uuid', { name: 'payee_id' })
  payeeId: string;

  /** Integer satang. */
  @Column('integer')
  amount: number;

  @Column('timestamptz', { name: 'paid_at' })
  paidAt: Date;
}
