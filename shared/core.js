const express = require("express");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const { randomUUID } = require("crypto");
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error("JWT_SECRET must contain at least 32 characters");
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 12 })
  : null;
const fail = (status, message) => Object.assign(new Error(message), { status });
const assert = (condition, status, message) => {
  if (!condition) throw fail(status, message);
};
function tokenUser(token) {
  try {
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "campuskit",
      audience: "campuskit",
    });
  } catch {
    throw fail(401, "Please sign in again");
  }
}
function sign(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, {
    expiresIn: "2h",
    issuer: "campuskit",
    audience: "campuskit",
  });
}
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
function app(name) {
  const a = express();
  a.disable("x-powered-by");
  a.use(express.json({ limit: "2mb" }));
  a.use((req, res, next) => {
    req.correlation =
      req.get("x-correlation-id")?.slice(0, 100) || randomUUID();
    res.set("x-correlation-id", req.correlation);
    res.on("finish", () =>
      console.log(
        JSON.stringify({
          service: name,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          correlation: req.correlation,
        }),
      ),
    );
    next();
  });
  a.get(
    "/health",
    asyncRoute(async (_, res) => {
      if (pool) await pool.query("SELECT 1");
      res.json({ service: name, status: "ok" });
    }),
  );
  return a;
}
function auth(req, res, next) {
  try {
    req.token = (req.get("authorization") || "").replace(/^Bearer /, "");
    req.user = tokenUser(req.token);
    next();
  } catch (e) {
    next(e);
  }
}
function internal(req, res, next) {
  if (req.get("x-service-token") !== process.env.INTERNAL_SECRET)
    return next(fail(401, "Internal service authentication required"));
  next();
}
function errors(a) {
  a.use((err, req, res, next) => {
    const status =
      err.status || (err.code === "23P01" || err.code === "23505" ? 409 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({
      error:
        status === 500 ? "Service operation failed; retry safely" : err.message,
      correlation: req.correlation,
    });
  });
}
async function transaction(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function http(
  url,
  { token, correlation, method = "GET", body, service = false } = {},
) {
  let r;
  try {
    r = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(service ? { "x-service-token": process.env.INTERNAL_SECRET } : {}),
        "x-correlation-id": correlation || randomUUID(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw fail(503, "A collaborator is unavailable; retry this operation");
  }
  const data = await r.json();
  if (!r.ok)
    throw fail(r.status, data.error || "Collaborator rejected request");
  return data;
}
async function eligible(req) {
  const u = await http(
    `${process.env.IDENTITY_URL}/internal/users/${req.user.sub}`,
    { service: true },
  );
  assert(
    u.verified && !u.suspended,
    403,
    "Current student verification is required",
  );
  return u;
}
function text(v, field, max = 200) {
  assert(
    typeof v === "string" && v.trim().length > 0 && v.length <= max,
    400,
    `${field} is required (max ${max} characters)`,
  );
  return v.trim();
}
function cents(v, field, zero = false) {
  assert(
    typeof v === "number" &&
      Number.isFinite(v) &&
      v >= (zero ? 0 : 0.01) &&
      v <= 1000000 &&
      Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    400,
    `${field} must be a valid THB amount with at most 2 decimals`,
  );
  return Math.round(v * 100);
}
module.exports = {
  app,
  auth,
  internal,
  errors,
  asyncRoute,
  pool,
  transaction,
  http,
  eligible,
  assert,
  fail,
  sign,
  tokenUser,
  text,
  cents,
  randomUUID,
};
