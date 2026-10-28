# Load test results

**Status: Not run yet; run after the week-14 lecture (4 Nov).** Replace every TODO after the run.
Raw k6 summaries: `loadtest/results/load-summary.json` and `loadtest/results/stress-summary.json`.

## Test environment

| Item | Value |
| --- | --- |
| Date of run | TODO |
| Machine | TODO (model, OS) |
| CPU | TODO (model, cores) |
| RAM | TODO |
| Docker | TODO (Docker Engine or Desktop version, memory and CPU limits) |
| k6 version | TODO |
| Listing replicas | 1 |
| Load generator | TODO (same machine as the stack, or another machine) |
| Git commit | TODO |

## Data set

- 1,500 listings seeded by `npm run seed:listing` (fixed IDs, keywords such as textbook, laptop,
  and tent in the titles), after `npm run seed` for the Identity demo accounts.
- All requests go through the API gateway; both endpoints are public, so no token is used.

## Request mix

| Request | Share | Detail |
| --- | --- | --- |
| Search `GET /api/listing/listings` | 70% | Random keyword only, category only, both, or neither; page 1-3; page size 20 |
| Detail `GET /api/listing/listings/<id>` | 30% | Random seeded listing ID |

Think time: 0.5-1.5 s between requests per VU.

## Thresholds

From the performance requirement in `docs/requirements.md`.

| Metric | Threshold |
| --- | --- |
| Search latency | p95 < 1,000 ms |
| Detail latency | p95 < 500 ms |
| Failed requests | < 0.5% |

## Load test (`load.js`)

Shape: 0 to 300 VUs in 2 min, hold 300 for 5 min, ramp down 30 s.

| VUs | req/s | p95 search (ms) | p95 detail (ms) | Error rate | Search p95 | Detail p95 | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 300 | TODO | TODO | TODO | TODO | TODO pass/fail | TODO pass/fail | TODO pass/fail |

## Stress test (`stress.js`)

Shape: 2 min ramp and 2 min hold at each of 300, 600, and 1,000 VUs, then 1 min ramp down.
Read each step from the hold period (for example from a k6 web dashboard or Grafana export); the
JSON summary only covers the whole run.

| VUs | req/s | p95 search (ms) | p95 detail (ms) | Error rate | Search p95 | Detail p95 | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 300 | TODO | TODO | TODO | TODO | TODO pass/fail | TODO pass/fail | TODO pass/fail |
| 600 | TODO | TODO | TODO | TODO | TODO pass/fail | TODO pass/fail | TODO pass/fail |
| 1,000 | TODO | TODO | TODO | TODO | TODO pass/fail | TODO pass/fail | TODO pass/fail |
| Whole run | TODO | TODO | TODO | TODO | TODO pass/fail | TODO pass/fail | TODO pass/fail |

Breaking point: TODO (the VU level where a threshold first fails, and which one).

## Interpretation

TODO: answer these after the run.

- Where does latency start to rise, and is it search, detail, or both?
- Does throughput (req/s) stop growing while VUs keep rising? At what level?
- What is the bottleneck? Compare `docker stats` during the run: Listing CPU, PostgreSQL CPU and
  connections, or the gateway proxy.
- Which errors appear (timeouts, 5xx, connection refused), and from which component?
- What change would help, and what would it cost? For example, database indexes on the search
  columns, more Listing replicas behind the gateway (the Should item on scalability in
  `docs/team-plan.md`), or caching search results.
- Does the system meet the performance requirement at 300 VUs? If not, what must change before it does?
