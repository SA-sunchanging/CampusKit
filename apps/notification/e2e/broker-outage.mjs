// Resilience measurement: bookings keep working while RabbitMQ is down, and every event reaches
// the inbox once the broker is back.
//   docker compose up --build -d && npm run seed && node apps/notification/e2e/broker-outage.mjs
// The owner (somchai) lists an item, the script stops RabbitMQ, the renter (malee) requests
// BOOKINGS one-day bookings and the owner approves each. After OUTAGE_MS the script starts
// RabbitMQ again and polls both inboxes until every expected notice is there, at most
// RECOVERY_LIMIT_MS. It passes when no booking failed, every notice arrived within the limit,
// and no notice arrived twice. RabbitMQ is started again even when a step fails.
// Plain Node 24 (fetch), no dependencies. GATEWAY_URL overrides the gateway address.

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PASSWORD = 'campuskit-demo';
const OWNER_EMAIL = 'somchai@student.chula.ac.th';
const RENTER_EMAIL = 'malee@student.chula.ac.th';
const BOOKINGS = 20;
const OUTAGE_MS = 60_000;
const RECOVERY_LIMIT_MS = 60_000;
const POLL_MS = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
/** A 1x1 PNG, enough for Listing's photo rules. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const run = promisify(execFile);

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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sends one JSON request and returns { status, body } without judging the status. */
async function send(method, path, { token, body } = {}) {
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
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let parsed;
  try {
    parsed = text === '' ? undefined : JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

/** Sends one JSON request and returns the body; fails the step on an unexpected status. */
async function call(step, method, path, { status = 200, ...options } = {}) {
  let reply;
  try {
    reply = await send(method, path, options);
  } catch (err) {
    fail(step, `${method} ${path} failed: ${String(err)}`);
  }
  if (reply.status !== status) {
    fail(
      step,
      `${method} ${path} answered ${reply.status}, expected ${status}`,
      JSON.stringify(reply.body, null, 2),
    );
  }
  return reply.body;
}

async function compose(...args) {
  await run('docker', ['compose', ...args], { cwd: REPO_ROOT });
}

/** Bangkok day number `offset` days after today, as [midnight, midnight + 24 h) in UTC. */
function bangkokDay(offset, now = Date.now()) {
  const today = Math.floor((now + BANGKOK_OFFSET_MS) / DAY_MS);
  const start = (today + offset) * DAY_MS - BANGKOK_OFFSET_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(start + DAY_MS).toISOString(),
  };
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function logIn(step, email) {
  const reply = await call(step, 'POST', '/api/identity/auth/login', {
    body: { email, password: PASSWORD },
  });
  check(step, typeof reply?.accessToken === 'string', 'no accessToken', reply);
  print(`ok   ${step}`);
  return reply.accessToken;
}

async function inbox(token) {
  const reply = await call('read the inbox', 'GET', '/api/notification/inbox', {
    token,
  });
  return reply.entries;
}

async function createListing(owner) {
  const step = 'create and publish a listing as the owner';
  let listing = await call(step, 'POST', '/api/listing/listings', {
    token: owner,
    status: 201,
    body: {
      title: `Broker outage ${new Date().toISOString()}`,
      category: 'BOOKS',
      description: 'Created by apps/notification/e2e/broker-outage.mjs.',
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
      { token: owner },
    );
  }
  check(step, listing.status === 'PUBLISHED', 'not PUBLISHED', listing);
  print(`ok   ${step}: ${listing.id}`);
  return listing;
}

/** Waits for listing.published, so the pipeline is known to work before the outage. */
async function waitForPublished(owner, listing) {
  const step = 'see listing.published in the owner inbox (broker up)';
  const deadline = Date.now() + RECOVERY_LIMIT_MS;
  while (Date.now() < deadline) {
    const entries = await inbox(owner);
    if (
      entries.some(
        (e) =>
          e.type === 'listing.published' && e.data?.listingId === listing.id,
      )
    ) {
      print(`ok   ${step}`);
      return;
    }
    await wait(POLL_MS);
  }
  fail(step, 'listing.published did not arrive');
}

/** Requests and approves one booking; returns its ID or the failure. */
async function bookOnce(owner, renter, listing, offset) {
  const period = bangkokDay(offset);
  const requested = await send('POST', '/api/booking/bookings', {
    token: renter,
    body: { listingId: listing.id, period },
  });
  if (requested.status !== 201) {
    return {
      error: `request ${requested.status} ${JSON.stringify(requested.body)}`,
    };
  }
  const approved = await send(
    'POST',
    `/api/booking/bookings/${requested.body.id}/approve`,
    { token: owner },
  );
  if (approved.status !== 200 || approved.body?.status !== 'CONFIRMED') {
    return {
      id: requested.body.id,
      error: `approve ${approved.status} ${JSON.stringify(approved.body)}`,
    };
  }
  return { id: requested.body.id };
}

/** Every notice the bookings should produce: requested to the owner, confirmed to both. */
function expectedNotices(bookingIds) {
  return bookingIds.flatMap((bookingId) => [
    { who: 'owner', type: 'booking.requested', bookingId },
    { who: 'owner', type: 'booking.confirmed', bookingId },
    { who: 'renter', type: 'booking.confirmed', bookingId },
  ]);
}

function matches(entries, notice) {
  return entries.filter(
    (e) => e.type === notice.type && e.data?.bookingId === notice.bookingId,
  );
}

/** Polls both inboxes; returns each notice's delay after the restart and the duplicates seen. */
async function awaitNotices(tokens, notices, restartedAt) {
  const delays = new Map();
  let duplicates = 0;
  const deadline = restartedAt + RECOVERY_LIMIT_MS;
  while (delays.size < notices.length && Date.now() < deadline) {
    const seen = {
      owner: await inbox(tokens.owner),
      renter: await inbox(tokens.renter),
    };
    const now = Date.now();
    duplicates = 0;
    notices.forEach((notice, index) => {
      const found = matches(seen[notice.who], notice);
      duplicates += Math.max(0, found.length - 1);
      if (found.length > 0 && !delays.has(index)) {
        delays.set(index, now - restartedAt);
      }
    });
    await wait(POLL_MS);
  }
  return { delays: [...delays.values()], duplicates };
}

async function outage(tokens, listing) {
  const before = {
    owner: await inbox(tokens.owner),
    renter: await inbox(tokens.renter),
  };
  await compose('stop', 'rabbitmq');
  const stoppedAt = Date.now();
  print('ok   stop RabbitMQ');

  const results = [];
  for (let i = 1; i <= BOOKINGS; i++) {
    results.push(await bookOnce(tokens.owner, tokens.renter, listing, i));
  }
  const failed = results.filter((r) => r.error);
  failed.forEach((r) => print(`     failed booking: ${r.error}`));
  print(
    `${failed.length === 0 ? 'ok  ' : 'FAIL'} ${BOOKINGS - failed.length}/${BOOKINGS} bookings confirmed while RabbitMQ was down`,
  );

  const ids = results.filter((r) => !r.error).map((r) => r.id);
  const notices = expectedNotices(ids);
  const during = {
    owner: await inbox(tokens.owner),
    renter: await inbox(tokens.renter),
  };
  const early = notices.filter((n) => matches(during[n.who], n).length > 0);
  print(
    `     notices visible during the outage: ${early.length}/${notices.length} (inbox had ${before.owner.length + before.renter.length} entries before)`,
  );

  await wait(Math.max(0, stoppedAt + OUTAGE_MS - Date.now()));
  await compose('start', 'rabbitmq');
  const restartedAt = Date.now();
  print(
    `ok   start RabbitMQ after ${((restartedAt - stoppedAt) / 1000).toFixed(1)} s down`,
  );
  return { failed, notices, restartedAt };
}

function report(failed, notices, delays, duplicates) {
  const arrived = delays.length;
  print('');
  print('Result');
  print(
    `  bookings requested and approved: ${BOOKINGS}, failed: ${failed.length}`,
  );
  print(
    `  notices expected: ${notices.length}, arrived: ${arrived}, duplicates: ${duplicates}`,
  );
  if (arrived > 0) {
    const p50 = percentile(delays, 0.5) / 1000;
    const max = Math.max(...delays) / 1000;
    print(
      `  delay after restart: p50 ${p50.toFixed(1)} s, max ${max.toFixed(1)} s`,
    );
  }
  return failed.length === 0 && arrived === notices.length && duplicates === 0;
}

async function main() {
  print(`Broker outage against ${BASE_URL}`);
  const owner = await logIn('log in the owner (somchai)', OWNER_EMAIL);
  const renter = await logIn('log in the renter (malee)', RENTER_EMAIL);
  const listing = await createListing(owner);
  await waitForPublished(owner, listing);
  const tokens = { owner, renter };
  try {
    const { failed, notices, restartedAt } = await outage(tokens, listing);
    const { delays, duplicates } = await awaitNotices(
      tokens,
      notices,
      restartedAt,
    );
    if (!report(failed, notices, delays, duplicates)) {
      fail('measure', 'resilience target missed');
    }
    print('PASS broker outage');
  } finally {
    await compose('start', 'rabbitmq');
  }
}

try {
  await main();
} catch (err) {
  process.stderr.write(
    `FAIL ${err instanceof StepFailure ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
}
