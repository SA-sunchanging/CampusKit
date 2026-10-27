import { createHttpService, JWT_SECRET } from '@app/common';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { GatewayModule } from './gateway.module.js';
import { configureGateway } from './gateway.setup.js';

interface Received {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
}

const jwt = new JwtService({ secret: JWT_SECRET });
const valid = jwt.sign({ sub: 'u1', role: 'student' });
const encode = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const fakes = {
  'another secret': new JwtService({ secret: 'not-the-secret' }).sign({
    sub: 'u1',
    role: 'admin',
  }),
  'alg none': `${encode({ alg: 'none' })}.${encode({ sub: 'u1', role: 'admin' })}.`,
  garbage: 'garbage',
};

let received: Received[];
let upstream: Server;
let app: INestApplication;

/** Stands in for every REST service: records each request and answers 200. */
async function startUpstream(): Promise<string> {
  upstream = createServer((req, res) => {
    received.push({ method: req.method, url: req.url, headers: req.headers });
    req.resume();
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));
  return `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  const target = await startUpstream();
  app = await createHttpService(GatewayModule, 'gateway', {
    bodyParser: false,
  });
  configureGateway(app, { identity: target, listing: target });
  await app.init();
});

afterAll(async () => {
  await app.close();
  await new Promise((resolve) => upstream.close(resolve));
});

beforeEach(() => {
  received = [];
});

const http = () => request(app.getHttpServer());

describe('gateway tokens', () => {
  it('rejects a protected route without a token and does not forward it', async () => {
    const res = await http().get('/api/listing/listings').expect(401);
    expect(res.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
    });
    expect(received).toHaveLength(0);
  });

  it.each(Object.entries(fakes))(
    'rejects a token from %s',
    async (_name, token) => {
      const res = await http()
        .get('/api/identity/accounts/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      expect(res.body.error.message).toBe('Invalid token');
      expect(received).toHaveLength(0);
    },
  );

  it('forwards a valid token to the service', async () => {
    await http()
      .get('/api/identity/accounts/me')
      .set('Authorization', `Bearer ${valid}`)
      .expect(200);
    expect(received[0].url).toBe('/accounts/me');
    expect(received[0].headers.authorization).toBe(`Bearer ${valid}`);
  });

  it.each([
    ['post', '/api/identity/auth/login', '/auth/login'],
    ['post', '/api/identity/accounts', '/accounts'],
    ['get', '/api/listing/health', '/health'],
  ] as const)(
    'lets %s %s through without a token',
    async (method, path, url) => {
      await http()[method](path).send({ email: 'a@b.c' }).expect(200);
      expect(received[0].url).toBe(url);
    },
  );

  it('protects the gateway-owned booking routes', async () => {
    await http().get('/api/booking/bookings/b1').expect(401);
  });
});

describe('gateway headers', () => {
  it('strips identity headers before forwarding', async () => {
    await http()
      .get('/api/listing/listings')
      .set('Authorization', `Bearer ${valid}`)
      .set('X-User-Id', 'someone-else')
      .set('x-role', 'admin')
      .expect(200);
    expect(received[0].headers).not.toHaveProperty('x-user-id');
    expect(received[0].headers).not.toHaveProperty('x-role');
  });

  it('forwards and echoes the caller correlation ID', async () => {
    const res = await http()
      .get('/api/listing/health')
      .set('x-correlation-id', 'trace-123')
      .expect(200);
    expect(res.headers['x-correlation-id']).toBe('trace-123');
    expect(received[0].headers['x-correlation-id']).toBe('trace-123');
  });

  it('replaces a malformed correlation ID and forwards the new one', async () => {
    const res = await http()
      .get('/api/listing/health')
      .set('x-correlation-id', 'bad id;')
      .expect(200);
    const id = res.headers['x-correlation-id'];
    expect(id).not.toBe('bad id;');
    expect(received[0].headers['x-correlation-id']).toBe(id);
  });

  it('creates a correlation ID even for a rejected request', async () => {
    const res = await http().get('/api/listing/listings').expect(401);
    expect(res.headers['x-correlation-id']).toBeTruthy();
  });
});

describe('gateway internal paths', () => {
  it.each([
    '/api/identity/internal/users/u1/profile',
    '/api/identity/INTERNAL/users/u1/profile',
    '/api/identity/%69nternal/users/u1/profile',
    '/api/identity/accounts/..%2Finternal/users/u1/profile',
  ])('answers 404 for %s even with a valid token', async (path) => {
    await http().get(path).set('Authorization', `Bearer ${valid}`).expect(404);
    expect(received).toHaveLength(0);
  });
});
