import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export const LEDGER_OPERATIONS = [
  'AUTHORIZE',
  'CAPTURE',
  'VOID',
  'SETTLE',
] as const;

export type LedgerOperation = (typeof LEDGER_OPERATIONS)[number];

/**
 * One successful financial operation. operation_id is the caller's stable ID, so a retry finds
 * this row and gets the stored result back; request_hash detects an ID reused for another request.
 * The schema is defined by the migrations, not by this class.
 */
@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text', { name: 'operation_id', unique: true })
  operationId: string;

  @Column('text')
  operation: LedgerOperation;

  @Column('uuid', { name: 'booking_id' })
  bookingId: string;

  /** SHA-256 of the canonical JSON of the operation and its request body. */
  @Column('text', { name: 'request_hash' })
  requestHash: string;

  /** The reply sent the first time, returned again on a retry. */
  @Column('jsonb')
  result: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
