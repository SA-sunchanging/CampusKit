import { correlationId, ErrorFilter } from '@app/common';
import { BOOKING_CLIENT } from '@app/contracts';
import { type Metadata, status } from '@grpc/grpc-js';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { BookingModule } from './booking.module.js';

const id = '33333333-3333-4333-8333-333333333333';
const listingId = '11111111-1111-4111-8111-111111111111';
const period = {
  start: '2026-11-01T17:00:00.000Z',
  end: '2026-11-04T17:00:00.000Z',
};
const reply = {
  id,
  listingId,
  renterId: '00000000-0000-4000-8000-000000000001',
  ownerId: '00000000-0000-4000-8000-000000000002',
  status: 'PENDING',
  period,
  terms: { rentalFee: 6000, deposit: 30000, lateFeePerDay: 4000 },
  expiresAt: '2026-10-30T08:00:00.000Z',
  createdAt: '2026-10-29T08:00:00.000Z',
  updatedAt: '2026-10-29T08:00:00.000Z',
};
const booking = { ...reply, declineReason: '' };

const grpc = {
  requestBooking: vi.fn(),
  approveBooking: vi.fn(),
  declineBooking: vi.fn(),
  cancelBooking: vi.fn(),
  getBooking: vi.fn(),
  listBookings: vi.fn(),
  checkAvailability: vi.fn(),
};
let app: INestApplication;

beforeAll(async () => {
  const client = { getService: () => grpc } as unknown as ClientGrpc;
  const moduleRef = await Test.createTestingModule({ imports: [BookingModule] })
    .overrideProvider(BOOKING_CLIENT)
    .useValue(client)
    .compile();
  // The same pipeline as the gateway (libs/common bootstrap and gateway.setup.ts).
  app = moduleRef.createNestApplication({ bodyParser: false });
  app.use(correlationId);
  app.use('/api/booking', json());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ErrorFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  for (const method of Object.values(grpc)) {
    method.mockReset().mockReturnValue(of(reply));
  }
});

const http = () => request(app.getHttpServer());

/** The request message and metadata of the only call to a gRPC method. */
function sent(method: keyof typeof grpc): [unknown, Metadata] {
  expect(grpc[method]).toHaveBeenCalledTimes(1);
  return grpc[method].mock.calls[0] as [unknown, Metadata];
}

describe('POST /api/booking/bookings', () => {
  it('requests a booking as the caller and answers 201', async () => {
    const res = await http()
      .post('/api/booking/bookings')
      .set('Authorization', 'Bearer token')
      .set('x-correlation-id', 'corr-1')
      .send({ listingId, period, extra: 'dropped' })
      .expect(201);
    expect(res.body).toEqual(booking);
    const [message, metadata] = sent('requestBooking');
    expect(message).toEqual({ listingId, period });
    expect(metadata.get('authorization')).toEqual(['Bearer token']);
    expect(metadata.get('x-correlation-id')).toEqual(['corr-1']);
  });

  it('answers 400 without calling Booking for an invalid body', async () => {
    const res = await http()
      .post('/api/booking/bookings')
      .send({ listingId: 'x', period })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(grpc.requestBooking).not.toHaveBeenCalled();
  });

  it('answers 409 when the dates are taken', async () => {
    grpc.requestBooking.mockReturnValue(
      throwError(() => ({
        code: status.ALREADY_EXISTS,
        details: 'The dates are taken',
      })),
    );
    const res = await http()
      .post('/api/booking/bookings')
      .send({ listingId, period })
      .expect(409);
    expect(res.body.error.message).toBe('The dates are taken');
  });
});

describe('GET /api/booking/bookings', () => {
  it('lists with the role and status', async () => {
    grpc.listBookings.mockReturnValue(of({ bookings: [reply] }));
    const res = await http()
      .get('/api/booking/bookings?role=owner&status=PENDING')
      .expect(200);
    expect(res.body).toEqual({ bookings: [booking] });
    expect(sent('listBookings')[0]).toEqual({
      role: 'owner',
      status: 'PENDING',
    });
  });

  it('answers an empty list when Booking has none', async () => {
    grpc.listBookings.mockReturnValue(of({}));
    const res = await http()
      .get('/api/booking/bookings?role=renter')
      .expect(200);
    expect(res.body).toEqual({ bookings: [] });
    expect(sent('listBookings')[0]).toEqual({ role: 'renter', status: '' });
  });

  it('answers 400 without a role', async () => {
    await http().get('/api/booking/bookings').expect(400);
    expect(grpc.listBookings).not.toHaveBeenCalled();
  });
});

describe('GET /api/booking/bookings/:id', () => {
  it('reads one booking', async () => {
    const res = await http().get(`/api/booking/bookings/${id}`).expect(200);
    expect(res.body).toEqual(booking);
    expect(sent('getBooking')[0]).toEqual({ id });
  });

  it('answers 400 for an id that is not a UUID', async () => {
    await http().get('/api/booking/bookings/b1').expect(400);
    expect(grpc.getBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/booking/bookings/:id/approve and /decline', () => {
  it('approves and answers 200', async () => {
    grpc.approveBooking.mockReturnValue(of({ ...reply, status: 'CONFIRMED' }));
    const res = await http()
      .post(`/api/booking/bookings/${id}/approve`)
      .expect(200);
    expect(res.body.status).toBe('CONFIRMED');
    expect(sent('approveBooking')[0]).toEqual({ id });
  });

  it('declines with a trimmed reason and answers 200', async () => {
    await http()
      .post(`/api/booking/bookings/${id}/decline`)
      .send({ reason: '  Needed it myself ' })
      .expect(200);
    expect(sent('declineBooking')[0]).toEqual({
      id,
      reason: 'Needed it myself',
    });
  });

  it('declines without a body', async () => {
    await http().post(`/api/booking/bookings/${id}/decline`).expect(200);
    expect(sent('declineBooking')[0]).toEqual({ id, reason: '' });
  });

  it('answers 400 for a reason over 500 characters', async () => {
    await http()
      .post(`/api/booking/bookings/${id}/decline`)
      .send({ reason: 'x'.repeat(501) })
      .expect(400);
    expect(grpc.declineBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/booking/bookings/:id/cancel', () => {
  it('cancels with a trimmed reason as the caller and answers 200', async () => {
    grpc.cancelBooking.mockReturnValue(of({ ...reply, status: 'CANCELLED' }));
    const res = await http()
      .post(`/api/booking/bookings/${id}/cancel`)
      .set('Authorization', 'Bearer token')
      .send({ reason: '  Plans changed ' })
      .expect(200);
    expect(res.body.status).toBe('CANCELLED');
    const [message, metadata] = sent('cancelBooking');
    expect(message).toEqual({ id, reason: 'Plans changed' });
    expect(metadata.get('authorization')).toEqual(['Bearer token']);
  });

  it('cancels without a body', async () => {
    await http().post(`/api/booking/bookings/${id}/cancel`).expect(200);
    expect(sent('cancelBooking')[0]).toEqual({ id, reason: '' });
  });

  it('answers 400 for a reason over 200 characters', async () => {
    await http()
      .post(`/api/booking/bookings/${id}/cancel`)
      .send({ reason: 'x'.repeat(201) })
      .expect(400);
    expect(grpc.cancelBooking).not.toHaveBeenCalled();
  });

  it('answers 409 when the item is already picked up', async () => {
    grpc.cancelBooking.mockReturnValue(
      throwError(() => ({
        code: status.FAILED_PRECONDITION,
        details: 'The item was already picked up',
      })),
    );
    const res = await http()
      .post(`/api/booking/bookings/${id}/cancel`)
      .expect(409);
    expect(res.body.error.message).toBe('The item was already picked up');
  });
});

describe('GET /api/booking/listings/:listingId/availability', () => {
  it('checks the period', async () => {
    grpc.checkAvailability.mockReturnValue(of({ available: true }));
    const res = await http()
      .get(`/api/booking/listings/${listingId}/availability`)
      .query(period)
      .expect(200);
    expect(res.body).toEqual({ available: true });
    expect(sent('checkAvailability')[0]).toEqual({ listingId, period });
  });

  it('reads a left-out flag as not available', async () => {
    grpc.checkAvailability.mockReturnValue(of({}));
    const res = await http()
      .get(`/api/booking/listings/${listingId}/availability`)
      .query(period)
      .expect(200);
    expect(res.body).toEqual({ available: false });
  });

  it('answers 400 for a missing end', async () => {
    await http()
      .get(`/api/booking/listings/${listingId}/availability`)
      .query({ start: period.start })
      .expect(400);
    expect(grpc.checkAvailability).not.toHaveBeenCalled();
  });
});
