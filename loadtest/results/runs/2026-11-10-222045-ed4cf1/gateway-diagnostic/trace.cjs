// Test-only gateway preload. Record upstream socket reuse on request errors.
const http = require('node:http');
const { syncBuiltinESMExports } = require('node:module');
const originalRequest = http.request;
let matched = 0;
let errors = 0;
let reusedErrors = 0;
let assigned = 0;
let assignmentDelayTotalMs = 0;
let assignmentDelayMaxMs = 0;
let assignmentOver1ms = 0;
let assignmentOver10ms = 0;
let assignmentOver50ms = 0;
let assignmentOver100ms = 0;
let requestsWithQueue = 0;
let maxAgentQueue = 0;
let maxAgentActiveSockets = 0;
const report = () => console.log('DIAG_UPSTREAM_COUNTS ' + JSON.stringify({
  time: new Date().toISOString(), matched, errors, reusedErrors, assigned,
  assignmentDelayTotalMs, assignmentDelayMaxMs, assignmentOver1ms,
  assignmentOver10ms, assignmentOver50ms, assignmentOver100ms,
  requestsWithQueue, maxAgentQueue, maxAgentActiveSockets,
}));
setInterval(report, 30_000).unref();
process.once('exit', report);
http.request = function (...args) {
  const options = args[0];
  const host = process.env.DIAG_TARGET_HOST || 'listing';
  const port = Number(process.env.DIAG_TARGET_PORT || 3002);
  const listing = options && typeof options === 'object' &&
    (options.hostname === host || options.host === host || options.host === `${host}:${port}`) &&
    Number(options.port) === port;
  if (listing) matched++;
  if (listing && process.env.DIAG_NO_KEEPALIVE === '1') {
    options.agent = false;
    options.headers = { ...options.headers, connection: 'close' };
  }
  const started = listing ? process.hrtime.bigint() : 0n;
  const req = originalRequest.apply(this, args);
  if (listing) {
    const agent = options.agent;
    if (agent && typeof agent === 'object') {
      const count = (groups) => Object.values(groups || {}).reduce((total, items) => total + items.length, 0);
      const queued = count(agent.requests);
      if (queued > 0) requestsWithQueue++;
      maxAgentQueue = Math.max(maxAgentQueue, queued);
      maxAgentActiveSockets = Math.max(maxAgentActiveSockets, count(agent.sockets));
    }
    req.once('socket', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      assigned++;
      assignmentDelayTotalMs += ms;
      assignmentDelayMaxMs = Math.max(assignmentDelayMaxMs, ms);
      if (ms >= 1) assignmentOver1ms++;
      if (ms >= 10) assignmentOver10ms++;
      if (ms >= 50) assignmentOver50ms++;
      if (ms >= 100) assignmentOver100ms++;
    });
    req.once('error', (err) => {
      errors++;
      if (req.reusedSocket) reusedErrors++;
      console.error('DIAG_UPSTREAM_ERROR ' + JSON.stringify({
        time: new Date().toISOString(),
        code: err.code || null,
        message: err.message,
        reusedSocket: req.reusedSocket,
        correlationId: options.headers?.['x-correlation-id'] || null,
      }));
    });
  }
  return req;
};
syncBuiltinESMExports();
