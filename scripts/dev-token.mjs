// Mints a JWT for local testing before Identity's login works.
// Usage: node scripts/dev-token.mjs <userId> [student|admin]
// The secret must match the services' JWT_SECRET (default: dev-only-secret).
import { createHmac } from 'node:crypto';

const [sub = 'dev-user', role = 'student'] = process.argv.slice(2);
const secret = process.env.JWT_SECRET ?? 'dev-only-secret';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, role, iat: now, exp: now + 8 * 3600 })}`;
const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');

console.log(`${unsigned}.${signature}`);
