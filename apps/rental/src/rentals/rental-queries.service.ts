import type { AuthUser } from '@app/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InternalRentalResponse } from '../internal/internal-rental.response.js';
import type { RentalRole } from './dto/list-rentals.query.js';
import {
  RentalListResponse,
  RentalResponse,
  samePerson,
} from './rental.response.js';
import { findRental, RENTAL_COLUMNS, type RentalRow } from './rental.row.js';

/** GET /rentals returns at most this many rentals. */
export const LIST_LIMIT = 100;

/** Read side of Rental: the caller's rentals for the web app, and one rental for Review. */
@Injectable()
export class RentalQueriesService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * The caller's rentals as renter ("renter") or of their listings ("owner"), newest first,
   * at most LIST_LIMIT.
   */
  async list(caller: AuthUser, role: RentalRole): Promise<RentalListResponse> {
    const column = role === 'renter' ? 'renter_id' : 'owner_id';
    const rows = (await this.db.query(
      `SELECT ${RENTAL_COLUMNS} FROM rentals
       WHERE ${column} = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [caller.sub, LIST_LIMIT],
    )) as RentalRow[];
    return RentalListResponse.of(rows, caller.sub);
  }

  /** One rental for its renter or owner; anyone else gets 404. */
  async get(caller: AuthUser, id: string): Promise<RentalResponse> {
    const row = await findRental(this.db, id);
    if (
      !row ||
      (!samePerson(row.renter_id, caller.sub) &&
        !samePerson(row.owner_id, caller.sub))
    ) {
      throw new NotFoundException('Rental not found');
    }
    return RentalResponse.of(row, caller.sub);
  }

  /** One rental for another service, without its codes. */
  async getInternal(id: string): Promise<InternalRentalResponse> {
    const row = await findRental(this.db, id);
    if (!row) {
      throw new NotFoundException('Rental not found');
    }
    return InternalRentalResponse.of(row);
  }
}
