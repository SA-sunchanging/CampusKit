// Test-only aggregate timings; do not log queries, URLs, payloads, or credentials.
const pg = require(process.env.DIAG_PG_MODULE || '/app/node_modules/pg');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const limits = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, Infinity];
function histogram() { return { count: 0, totalMs: 0, maxMs: 0, bins: limits.map(() => 0) }; }
const poolAcquire = histogram();
const query = histogram();
const review = histogram();
let maxPoolWaiting = 0;
let poolCallsWithWaiters = 0;
function record(metric, start) {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  metric.count++;
  metric.totalMs += ms;
  metric.maxMs = Math.max(metric.maxMs, ms);
  metric.bins[limits.findIndex((limit) => ms <= limit)]++;
}
function summary(metric) {
  let n = 0;
  const threshold = metric.count * 0.95;
  let p95UpperBoundMs = null;
  if (metric.count) for (let i = 0; i < limits.length; i++) {
    n += metric.bins[i];
    if (n >= threshold) { p95UpperBoundMs = Number.isFinite(limits[i]) ? limits[i] : '>5000'; break; }
  }
  return { count: metric.count, meanMs: metric.count ? metric.totalMs / metric.count : null,
    p95UpperBoundMs, maxMs: metric.maxMs, bins: metric.bins };
}
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
const initialUtilization = performance.eventLoopUtilization();
function report() {
  console.log('DIAG_LISTING_COUNTS ' + JSON.stringify({
    time: new Date().toISOString(), boundsMs: limits.map((v) => Number.isFinite(v) ? v : '>5000'),
    poolAcquire: summary(poolAcquire), query: summary(query), review: summary(review),
    maxPoolWaiting, poolCallsWithWaiters,
    eventLoop: { p95Ms: loop.percentile(95) / 1e6, maxMs: loop.max / 1e6,
      utilization: performance.eventLoopUtilization(initialUtilization).utilization },
  }));
}
setInterval(report, 30_000).unref();
process.once('exit', report);

const connect = pg.Pool.prototype.connect;
pg.Pool.prototype.connect = function (...args) {
  const start = process.hrtime.bigint();
  if (typeof args[0] === 'function') {
    const callback = args[0];
    args[0] = function (...values) { record(poolAcquire, start); return callback.apply(this, values); };
  }
  const result = connect.apply(this, args);
  maxPoolWaiting = Math.max(maxPoolWaiting, this.waitingCount);
  if (this.waitingCount > 0) poolCallsWithWaiters++;
  if (result && typeof result.then === 'function') result.then(() => record(poolAcquire, start), () => record(poolAcquire, start));
  return result;
};

const clientQuery = pg.Client.prototype.query;
pg.Client.prototype.query = function (...args) {
  const start = process.hrtime.bigint();
  const callbackIndex = args.findIndex((arg) => typeof arg === 'function');
  if (callbackIndex >= 0) {
    const callback = args[callbackIndex];
    args[callbackIndex] = function (...values) { record(query, start); return callback.apply(this, values); };
  }
  const result = clientQuery.apply(this, args);
  if (callbackIndex < 0 && result && typeof result.then === 'function') result.then(() => record(query, start), () => record(query, start));
  return result;
};

const fetch = globalThis.fetch;
globalThis.fetch = function (...args) {
  const target = typeof args[0] === 'string' ? args[0] : '';
  if (!target.startsWith('http://review:3005/internal/reputation')) return fetch.apply(this, args);
  const start = process.hrtime.bigint();
  try {
    return fetch.apply(this, args).then(
      (res) => { record(review, start); return res; },
      (err) => { record(review, start); throw err; },
    );
  } catch (err) { record(review, start); throw err; }
};
