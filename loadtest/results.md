# Load test results

**Status: Completed on 2 November 2026.**

Evidence:
- `loadtest/results/load-summary.json`
- `loadtest/results/stress-summary.json`
- `loadtest/results/stress-timeseries.json`

Both tests completed. Some latency thresholds failed; results are reported without changing the original thresholds.

## Test environment

| Item | Value |
| --- | --- |
| Date of run | 2 November 2026 (Asia/Bangkok) |
| Machine | MacBook Air (MacBookAir10,1), macOS 26.5.1 (25F80) |
| CPU | Apple M1, 8 cores: 4 performance and 4 efficiency |
| RAM | 8 GB |
| Docker | Docker Desktop 4.37.2; Engine 27.4.0; Compose v2.31.0-desktop.2 |
| Docker VM resources | 8 CPUs; 4,109,737,984 bytes memory, approximately 3.83 GiB |
| k6 version | v2.3.0 (commit/devel, go1.27.1, darwin/arm64) |
| Listing replicas | 1 |
| Load generator | k6 on the same Mac as the Docker stack |
| Git commit | 5f9e393f65aef16ee532589d748f85e27faf4773 |

The operator confirmed that both seed commands completed successfully and that no code, build, or Docker resource changes were made between testing and collecting the environment information.

## Data set

- 1,500 listings seeded by `npm run seed:listing`, after `npm run seed` created the Identity demo accounts.
- Listings use fixed IDs and keywords such as textbook, laptop, and tent.
- All requests pass through the API Gateway.
- Both tested endpoints are public, so no authentication token is used.

## Request mix

| Request | Share | Detail |
| --- | --- | --- |
| Search `GET /api/listing/listings` | Approximately 70% | Random keyword only, category only, both, or neither; pages 1–3; page size 20 |
| Detail `GET /api/listing/listings/<id>` | Approximately 30% | Random seeded listing ID |

Think time: 0.5–1.5 seconds between requests per VU.

This workload measures listing reads. It does not measure booking, payment, handover, or settlement performance.

## Thresholds

Configured from the performance requirement in `docs/requirements.md`.

| Metric | Threshold |
| --- | --- |
| Search latency | p95 < 1,000 ms |
| Detail latency | p95 < 500 ms |
| Failed requests | < 0.5% |

p95 is the response time at or below which 95% of measured requests completed.

The failure rate is k6's `http_req_failed` metric, based on expected HTTP responses. It is not a separate server-error-only metric.

## Load test (`load.js`)

Shape: ramp from 0 to 300 VUs over 2 minutes, hold 300 VUs for 5 minutes, then ramp down over 30 seconds.

Command:

    k6 run loadtest/load.js

The following row reports the whole run, including ramp-up and ramp-down. It is not a measurement of the 300-VU hold period alone.

| Profile | req/s | p95 search (ms) | p95 detail (ms) | Error rate | Search p95 | Detail p95 | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Up to 300 VUs, whole run | 229.55 | 432.55 | 517.48 | 0.0058% | PASS | FAIL | PASS |

- Completed requests: 103,544.
- Failed requests: 6, comprising 3 search and 3 detail requests.
- Failed checks: 12, because each failed request failed two checks.
- Actual duration: 451.08 seconds.

Search passed its latency target. Detail exceeded its 500 ms target by 17.48 ms, approximately 3.5%. The failure rate passed, but the test did not meet all acceptance thresholds.

The aggregate summary does not establish the status codes or causes of the six failed requests.

## Stress test (`stress.js`)

Shape: a 2-minute ramp followed by a 2-minute hold at each of 300, 600, and 1,000 VUs, followed by a 1-minute ramp-down.

Command:

    k6 run --out json=loadtest/results/stress-timeseries.json loadtest/stress.js

### Constant-load periods

The per-level results below were calculated from the time-series file during the two-minute hold periods.

| VUs | Elapsed window |
| --- | --- |
| 300 | Approximately minutes 2–4 |
| 600 | Approximately minutes 6–8 |
| 1,000 | Approximately minutes 10–12 |

Windows were approximated relative to the first recorded HTTP request. Recorded VU samples within these windows matched the stated constant-load levels.

Throughput is the completed request count in each window divided by 120 seconds. Latency samples are grouped by their recorded completion timestamps.

| VUs | req/s | p95 search (ms) | p95 detail (ms) | Error rate | Search p95 | Detail p95 | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 300 | 267.87 | 648.26 | 757.71 | 0% | PASS | FAIL | PASS |
| 600 | 173.03 | 7,267.28 | 8,647.44 | 0% | FAIL | FAIL | PASS |
| 1,000 | 225.27 | 5,495.49 | 6,487.88 | 0.1406% | FAIL | FAIL | PASS |
| Whole run | 199.68 | 5,005.20 | 5,870.88 | 0.0244% | FAIL | FAIL | PASS |

| Hold period | Completed requests | Failed requests |
| --- | --- | --- |
| 300 VUs | 32,144 | 0 |
| 600 VUs | 20,764 | 0 |
| 1,000 VUs | 27,032 | 38 |

Whole-run totals include ramp periods as well as hold periods:

- Completed requests: 155,946.
- Failed requests: 38.
- All 38 failures were detail requests returning HTTP 502.
- Failed checks: 76, because each failed request failed two checks.
- Actual duration: 781.00 seconds.

### Breaking point

Detail latency failed at 300 VUs, the lowest measured constant-load level. Search passed at 300 VUs and failed at 600 VUs.

The exact maximum load that satisfies all thresholds was not established. It cannot be described as 300 VUs because detail already failed at that level. Additional lower-load tests would be needed to locate the boundary.

## Interpretation

### Where does latency rise?

Both endpoints were substantially slower at 600 and 1,000 VUs than at 300 VUs.

Detail was slower than search at every measured hold level and failed its stricter latency target at 300 VUs. Search failed its target at 600 VUs.

### Does throughput keep growing with VUs?

No. Hold-period throughput decreased from 267.87 req/s at 300 VUs to 173.03 req/s at 600 VUs, then increased to 225.27 req/s at 1,000 VUs.

Increasing concurrency did not produce proportional throughput growth. In this closed-loop workload, slower requests also delay each user's next iteration.

The non-monotonic result must be reported as observed. It does not establish a precise sustained-capacity limit.

### What is the bottleneck?

The bottleneck was not conclusively identified because resource metrics were not collected during testing.

k6 and the full Docker stack shared an 8 GB Mac. The Docker VM had approximately 3.83 GiB of memory available, so competition for host resources is a possible influence, not a confirmed cause.

Further diagnosis should collect:

- Host and container CPU and memory usage.
- PostgreSQL query timing and connection-pool usage.
- Gateway and downstream-service timing.
- Logs correlated with failed requests.

### Which errors appeared?

The stress time-series recorded 38 HTTP 502 responses, all on listing-detail requests during the 1,000-VU hold period.

The Gateway returned these responses, but the underlying cause remains unconfirmed. Gateway and downstream logs are required to distinguish timeouts, connection failures, service errors, or other causes.

The load test recorded six failed requests, but their status codes were not available in the aggregate summary.

### What changes could help, and what would they cost?

Potential improvements require measurement before selection:

| Possible change | When it may help | Cost or trade-off |
| --- | --- | --- |
| Query/index optimisation | Database queries are slow | Additional index storage and write overhead; may not address detail latency |
| More Listing replicas | Listing processing is the bottleneck | More CPU/RAM and connections; requires verified traffic distribution and sufficient host capacity |
| Caching | Repeated reads or downstream lookups are expensive | Invalidation complexity and potentially stale data |
| Separate load generator | The generator competes with the application for resources | Another machine and a changed test environment |

These are candidates for investigation, not confirmed fixes.

### Does the system meet the requirement at 300 VUs?

Not fully.

The load profile passed search latency and failure-rate thresholds but failed detail latency. The stress test's 300-VU hold period also failed detail latency.

Before claiming compliance, investigate detail latency, implement a supported improvement, and retest under a documented, comparable environment. Keep the original results for comparison.

## Limitations

- Each profile was executed once; run-to-run variability was not measured.
- The load generator and application stack shared one machine.
- CPU, memory, query timing, and connection-pool metrics were not captured during the runs.
- Whole-run statistics include changing load levels and do not represent only the peak-load hold period.
- Stress stages ran sequentially, so later stages may have been affected by earlier workload.
- The workload tested listing reads only.
- No exact all-threshold passing capacity was established.

## Conclusion

Both required test types were executed and analysed.

The tested environment did not satisfy every performance target. Detail latency narrowly missed its target in the load test, while both endpoints exceeded their latency targets under higher stress. HTTP request-failure rates remained below 0.5%.

The original thresholds and failed results are retained. Further performance claims require diagnosis and controlled retesting.