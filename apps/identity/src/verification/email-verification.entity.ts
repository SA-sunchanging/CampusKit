import { Column, Entity, PrimaryColumn } from 'typeorm';

/** The code an account must enter to verify its email. The schema is defined by the migrations. */
@Entity('email_verifications')
export class EmailVerification {
  @PrimaryColumn('uuid', { name: 'account_id' })
  accountId: string;

  /** HMAC-SHA-256 of the code; the code itself is never stored. */
  @Column('text', { name: 'code_hash' })
  codeHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  /** Confirmations tried with this code, right or wrong. */
  @Column('integer')
  attempts: number;

  /** When this code was issued; a new code replaces the row and resets it. */
  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;
}
