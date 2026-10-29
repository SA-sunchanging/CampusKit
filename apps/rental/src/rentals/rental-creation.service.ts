import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CreateRentalResponse } from '../internal/create-rental.response.js';
import { generateCode } from './codes.js';
import { RENTAL_COLUMNS, type RentalRow } from './rental.row.js';

/** Body of POST /internal/rentals, sent by Booking when it confirms a booking. */
export interface CreateRentalRequest {
  bookingId: string;
  listingId: string;
  ownerId: string;
  renterId: string;
  /** The half-open period [start, end), ISO-8601. */
  period: { start: string; end: string };
  /** Integer satang. */
  terms: { rentalFee: number; deposit: number; lateFeePerDay: number };
}

/** The request with its period parsed, as the rental stores it. */
interface NewRental {
  request: CreateRentalRequest;
  start: Date;
  end: Date;
}

function parse(request: CreateRentalRequest): NewRental {
  const start = new Date(request.period.start);
  const end = new Date(request.period.end);
  if (!(end.getTime() > start.getTime())) {
    throw new BadRequestException('The period must end after it starts');
  }
  if (request.ownerId.toLowerCase() === request.renterId.toLowerCase()) {
    throw new BadRequestException(
      'The owner and the renter must be different people',
    );
  }
  return { request, start, end };
}

/** Whether a stored rental was made from the same booking details (UUIDs ignore case). */
function sameRental(row: RentalRow, rental: NewRental): boolean {
  const { request, start, end } = rental;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return (
    same(row.listing_id, request.listingId) &&
    same(row.owner_id, request.ownerId) &&
    same(row.renter_id, request.renterId) &&
    row.period_start.getTime() === start.getTime() &&
    row.period_end.getTime() === end.getTime() &&
    row.rental_fee === request.terms.rentalFee &&
    row.deposit === request.terms.deposit &&
    row.late_fee_per_day === request.terms.lateFeePerDay
  );
}

/** Opens the rental of a confirmed booking (called by Booking on approval). */
@Injectable()
export class RentalCreationService {
  private readonly logger = new Logger(RentalCreationService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Creates one AWAITING_PICKUP rental per booking with a new pickup code and return code.
   * Repeating the request for the same booking returns the same rental; a request for the same
   * booking with other people, another period or other terms answers 409.
   */
  async create(request: CreateRentalRequest): Promise<CreateRentalResponse> {
    const rental = parse(request);
    const inserted = await this.insert(rental);
    if (inserted) {
      this.logger.log(
        `Rental ${inserted.id} opened for booking ${inserted.booking_id}`,
      );
      return CreateRentalResponse.of(inserted);
    }
    // A rental for this booking already exists, made by an earlier or concurrent request.
    const existing = await this.findByBooking(request.bookingId);
    if (!existing || !sameRental(existing, rental)) {
      this.logger.warn(
        `Booking ${request.bookingId} already has a rental with other details`,
      );
      throw new ConflictException(
        'The booking already has a rental with other details',
      );
    }
    return CreateRentalResponse.of(existing);
  }

  /** The new rental, or undefined when the booking already has one. */
  private async insert(rental: NewRental): Promise<RentalRow | undefined> {
    const { request, start, end } = rental;
    const [row] = (await this.db.query(
      `INSERT INTO rentals
         (booking_id, listing_id, owner_id, renter_id, period_start, period_end,
          rental_fee, deposit, late_fee_per_day, pickup_code, return_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (booking_id) DO NOTHING
       RETURNING ${RENTAL_COLUMNS}`,
      [
        request.bookingId,
        request.listingId,
        request.ownerId,
        request.renterId,
        start,
        end,
        request.terms.rentalFee,
        request.terms.deposit,
        request.terms.lateFeePerDay,
        generateCode(),
        generateCode(),
      ],
    )) as RentalRow[];
    return row;
  }

  private async findByBooking(
    bookingId: string,
  ): Promise<RentalRow | undefined> {
    const [row] = (await this.db.query(
      `SELECT ${RENTAL_COLUMNS} FROM rentals WHERE booking_id = $1`,
      [bookingId],
    )) as RentalRow[];
    return row;
  }
}
