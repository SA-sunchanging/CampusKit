// Shared helpers for the load and stress tests: request mix, URLs, and checks.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const LISTING_COUNT = 1500;

export const KEYWORDS = [
  'textbook',
  'calculator',
  'racket',
  'football',
  'gown',
  'jacket',
  'guitar',
  'keyboard',
  'camera',
  'laptop',
  'drill',
  'tent',
];

export const CATEGORIES = [
  'BOOKS',
  'ELECTRONICS',
  'SPORTS',
  'CLOTHING',
  'MUSIC',
  'TOOLS',
  'OTHER',
];

// Performance targets from docs/requirements.md, shared by load.js and stress.js.
export const PERFORMANCE_THRESHOLDS = {
  'http_req_duration{name:search}': ['p(95)<1000'],
  'http_req_duration{name:detail}': ['p(95)<500'],
  http_req_failed: ['rate<0.005'],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

// Seeded listings use fixed IDs: index 7 -> 00000000-0000-4000-9000-000000000007.
export function randomListingId() {
  const index = String(randomInt(1, LISTING_COUNT)).padStart(12, '0');
  return `00000000-0000-4000-9000-${index}`;
}

// Mix: keyword only, category only, both, or neither; page 1-3.
export function searchUrl() {
  const params = [];
  const shape = randomInt(0, 3);
  if (shape === 0 || shape === 2) {
    params.push(`q=${encodeURIComponent(pick(KEYWORDS))}`);
  }
  if (shape === 1 || shape === 2) {
    params.push(`category=${pick(CATEGORIES)}`);
  }
  params.push(`page=${randomInt(1, 3)}`, 'pageSize=20');
  return `${BASE_URL}/listings?${params.join('&')}`;
}

function parseJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

export function search() {
  const res = http.get(searchUrl(), { tags: { name: 'search' } });
  check(res, {
    'search status is 200': (r) => r.status === 200,
    'search has items array': (r) => {
      const body = parseJson(r);
      return body !== null && Array.isArray(body.items);
    },
  });
}

export function detail() {
  const id = randomListingId();
  const res = http.get(`${BASE_URL}/listings/${id}`, {
    tags: { name: 'detail' },
  });
  check(res, {
    'detail status is 200': (r) => r.status === 200,
    'detail id matches': (r) => {
      const body = parseJson(r);
      return body !== null && body.id === id;
    },
  });
}

// One virtual-user iteration: 70% search, 30% detail, then 0.5-1.5 s think time.
export function visit() {
  if (Math.random() < 0.7) {
    search();
  } else {
    detail();
  }
  sleep(0.5 + Math.random());
}
