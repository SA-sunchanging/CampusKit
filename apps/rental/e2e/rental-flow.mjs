// End-to-end check of the rental flow through the gateway of a running stack:
//   docker compose up --build -d && npm run seed && node apps/rental/e2e/rental-flow.mjs
// The owner (somchai) lists an item, the renter (malee) books the next whole Bangkok day, the
// owner approves, the renter picks up with the owner's code, the owner takes the item back with
// the renter's code, and Payment shows the fee captured, the deposit released and the payout.
// Each run creates a new listing. Plain Node 24 (fetch), no dependencies. GATEWAY_URL overrides
// the gateway address. Exits with 1 on the first failed step and prints the response body.

const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const PASSWORD = 'campuskit-demo';
const OWNER_EMAIL = 'somchai@student.chula.ac.th';
const RENTER_EMAIL = 'malee@student.chula.ac.th';
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/** A 1x1 PNG, enough for Listing's photo rules. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

class StepFailure extends Error {}

function print(line) {
  process.stdout.write(`${line}\n`);
}

function fail(step, message, body) {
  const detail = body === undefined ? '' : `\n${body}`;
  throw new StepFailure(`${step}: ${message}${detail}`);
}

function check(step, condition, message, body) {
  if (!condition) {
    fail(step, message, JSON.stringify(body, null, 2));
  }
}

/** Sends one JSON request and returns the parsed body; fails the step on an unexpected status. */
async function call(step, method, path, { token, body, status = 200 } = {}) {
  const init = {
    method,
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  };
  if (token) {
    init.headers.authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (err) {
    fail(step, `${method} ${path} failed: ${String(err)}`);
  }
  const text = await res.text();
  if (res.status !== status) {
    fail(
      step,
      `${method} ${path} answered ${res.status}, expected ${status}`,
      text,
    );
  }
  try {
    return text === '' ? undefined : JSON.parse(text);
  } catch {
    fail(step, `${method} ${path} did not answer JSON`, text);
  }
}

/** The next whole Bangkok day, [midnight, midnight + 24 h), as UTC ISO-8601. */
function nextBangkokDay(now = Date.now()) {
  const bangkokDay = Math.floor((now + BANGKOK_OFFSET_MS) / DAY_MS);
  const start = (bangkokDay + 1) * DAY_MS - BANGKOK_OFFSET_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + DAY_MS).toISOString(),
  };
}

async function logIn(step, email) {
  const reply = await call(step, 'POST', '/api/identity/auth/login', {
    body: { email, password: PASSWORD },
  });
  check(step, typeof reply?.accessToken === 'string', 'no accessToken', reply);
  print(`ok   ${step}`);
  return reply.accessToken;
}

async function createListing(owner) {
  const step = 'create and publish a listing as the owner';
  let listing = await call(step, 'POST', '/api/listing/listings', {
    token: owner,
    status: 201,
    body: {
      title: `E2E rental flow ${new Date().toISOString()}`,
      category: 'BOOKS',
      description: 'Created by apps/rental/e2e/rental-flow.mjs.',
      condition: 'GOOD',
      accessories: [],
      replacementValue: 120000,
      dailyRate: 2000,
      deposit: 30000,
      lateFeePerDay: 4000,
      maxRentalDays: 7,
      pickupLocations: ['ENGINEERING'],
      blackouts: [],
      photos: [PIXEL],
      thumbnail: PIXEL,
    },
  });
  if (listing.status !== 'PUBLISHED') {
    listing = await call(
      step,
      'POST',
      `/api/listing/listings/${listing.id}/publish`,
      {
        token: owner,
      },
    );
  }
  check(
    step,
    listing.status === 'PUBLISHED',
    'listing is not PUBLISHED',
    listing,
  );
  print(`ok   ${step}: ${listing.id}`);
  return listing;
}

async function bookAndApprove(owner, renter, listing) {
  let step = 'request the next Bangkok day as the renter';
  const period = nextBangkokDay();
  const requested = await call(step, 'POST', '/api/booking/bookings', {
    token: renter,
    status: 201,
    body: { listingId: listing.id, period },
  });
  check(
    step,
    requested.status === 'PENDING',
    'booking is not PENDING',
    requested,
  );
  print(`ok   ${step}: ${requested.id} ${period.start} - ${period.end}`);

  step = 'approve the booking as the owner';
  const approved = await call(
    step,
    'POST',
    `/api/booking/bookings/${requested.id}/approve`,
    {
      token: owner,
    },
  );
  check(
    step,
    approved.status === 'CONFIRMED',
    'booking is not CONFIRMED',
    approved,
  );
  print(`ok   ${step}: CONFIRMED`);
  return approved;
}

async function pickUp(owner, renter, booking) {
  let step = "read the pickup code from the owner's rentals";
  const list = await call(step, 'GET', '/api/rental/rentals?role=owner', {
    token: owner,
  });
  const rental = list.rentals.find((item) => item.bookingId === booking.id);
  check(step, rental !== undefined, 'no rental for the booking', list);
  check(
    step,
    rental.status === 'AWAITING_PICKUP',
    'rental is not AWAITING_PICKUP',
    rental,
  );
  check(
    step,
    /^[0-9]{6}$/.test(rental.pickupCode),
    'no pickup code for the owner',
    rental,
  );
  print(`ok   ${step}: rental ${rental.id}`);

  step = 'confirm pickup as the renter';
  const active = await call(
    step,
    'POST',
    `/api/rental/rentals/${rental.id}/pickup`,
    {
      token: renter,
      body: { code: rental.pickupCode },
    },
  );
  check(step, active.status === 'ACTIVE', 'rental is not ACTIVE', active);
  print(`ok   ${step}: ACTIVE`);
  return active;
}

async function takeBack(owner, renter, rental) {
  let step = 'read the return code as the renter';
  const seen = await call(step, 'GET', `/api/rental/rentals/${rental.id}`, {
    token: renter,
  });
  check(
    step,
    /^[0-9]{6}$/.test(seen.returnCode),
    'no return code for the renter',
    seen,
  );
  print(`ok   ${step}`);

  step = 'confirm the return as the owner';
  const closed = await call(
    step,
    'POST',
    `/api/rental/rentals/${rental.id}/return`,
    {
      token: owner,
      body: { code: seen.returnCode },
    },
  );
  check(step, closed.status === 'CLOSED', 'rental is not CLOSED', closed);
  check(step, closed.lateFee === 0, 'an on-time return has a late fee', closed);
  print(`ok   ${step}: CLOSED`);
  return closed;
}

async function checkPayments(owner, rental) {
  const step = 'check the payment status';
  const status = await call(
    step,
    'GET',
    `/api/payment/payments/bookings/${rental.bookingId}`,
    {
      token: owner,
    },
  );
  const { rentalFee, deposit } = rental.terms;
  const fee = status.authorizations.find((item) => item.kind === 'FEE');
  const hold = status.authorizations.find((item) => item.kind === 'DEPOSIT');
  check(
    step,
    fee?.status === 'CAPTURED' && fee.capturedAmount === rentalFee,
    `the fee of ${rentalFee} is not CAPTURED`,
    status,
  );
  check(
    step,
    hold?.status === 'SETTLED' &&
      hold.releasedAmount === deposit &&
      hold.capturedAmount === 0,
    `the deposit of ${deposit} is not SETTLED with a full release`,
    status,
  );
  check(
    step,
    status.payout?.amount === rentalFee,
    `the payout is not ${rentalFee}`,
    status,
  );
  print(
    `ok   ${step}: fee ${rentalFee} captured, deposit ${deposit} released, payout ${rentalFee}`,
  );
}

async function main() {
  print(`Rental flow against ${BASE_URL}`);
  const owner = await logIn('log in the owner (somchai)', OWNER_EMAIL);
  const renter = await logIn('log in the renter (malee)', RENTER_EMAIL);
  const listing = await createListing(owner);
  const booking = await bookAndApprove(owner, renter, listing);
  const active = await pickUp(owner, renter, booking);
  const closed = await takeBack(owner, renter, active);
  await checkPayments(owner, closed);
  print('PASS rental flow');
}

try {
  await main();
} catch (err) {
  process.stderr.write(
    `FAIL ${err instanceof StepFailure ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
}
