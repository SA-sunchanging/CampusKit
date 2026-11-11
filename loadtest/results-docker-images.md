# Load test: old vs slim Docker images

**Status: Inconclusive on failed requests; run on 11 November 2026.**

This test checks whether the slim service images (one traced `node_modules` per service on plain
Alpine, about 218 MB instead of 511 MB) change how the stack behaves under load. It does not replace
the results in `loadtest/results.md`, which come from another machine.

Evidence, all written by `load.js`:
- `loadtest/results/docker-images-old-local-main.json`
- `loadtest/results/docker-images-old-origin-main.json`
- `loadtest/results/docker-images-slim-run1.json`
- `loadtest/results/docker-images-slim-run2.json`

## Test environment

| Item | Value |
| --- | --- |
| Machine | MacBook Pro (MacBookPro18,3), Apple M1 Pro, 16 GB RAM |
| Docker | Docker Desktop, Engine 29.8.2, Compose 5.6.0; VM with 8 CPUs and about 7.7 GiB memory |
| k6 | v2.3.0 in the `grafana/k6` container on the Compose network (`BASE_URL=http://gateway:3000`) |
| Load generator | k6 inside the same Docker VM as the stack, so it shares the VM's CPU |
| Data set | 1,500 seeded listings plus one hand-made listing |
| Script | `loadtest/load.js` unchanged: 0 to 300 VUs in 2 min, hold 5 min, ramp down 30 s |

Each run started a few seconds after `docker compose up -d --build`. Container CPU and memory were
sampled with `docker stats` during every run.

## Runs

| Run | Images | Code | req/s | Failed requests | p95 search (ms) | p95 detail (ms) | Slowest (s) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Old, local main | 511 MB | `365924b` | 244.14 | 0 | 64.07 | 61.89 | 2.95 |
| Old, origin/main | 511 MB | `21e46a8` | 248.06 | 0 | 11.22 | 8.59 | 0.38 |
| Slim, run 1 | 218 MB | branch on `21e46a8` | 243.59 | 18 | 25.45 | 22.17 | 4.11 |
| Slim, run 2 (invalid) | 218 MB | branch on `21e46a8` | 131.48 | 22 | 690.49 | 969.26 | 125.13 |

All valid runs pass every threshold in `load.js` (search p95 < 1 s, detail p95 < 500 ms, failures
< 0.5%; slim run 1 failed 0.016% of requests).

**Slim run 2 is invalid.** The Mac was unplugged at 09:49 and its lid closed at 09:50, about two
minutes into the run; it slept until 09:56 (`pmset -g log`). Sleep froze the Docker VM, which explains
the 125-second requests. The other three runs ran on AC power with no sleep.

## Failed requests

All 18 failures in slim run 1 were the gateway answering 502 after `read ECONNRESET` from Listing
(gateway log `listing unavailable ...`), in two bursts near the end of the ramp-up. The gateway proxy
uses Node's default HTTP agent, which reuses connections, and Listing keeps Node's default 5-second
keep-alive timeout. A request sent on a connection that Listing is closing at that moment fails this
way. This depends on code and the Node version, which are the same in both images; the teammates'
earlier runs on the old images also recorded occasional 502s from Listing (`loadtest/results.md`).

That explanation is not proven: both valid old-image runs had 0 failures and the one valid slim run
had 18. A clean second slim run was not completed.

## Resources

Peak memory per container was about the same with both images (for example Listing 342 MiB old,
341 MiB slim; Identity 97 MiB old, 92 MiB slim). Average CPU per container was also similar.

## Interpretation

- Throughput and latency with the slim images are within the run-to-run spread of the old images;
  the two old-image runs alone differ six-fold in p95.
- Image size does not change request handling: the compiled code and the `node` binary are the same.
- Whether the slim images cause more connection resets is open. Repeat the slim and old runs on AC
  power with the lid open, and consider setting Listing's `keepAliveTimeout` above the gateway
  agent's idle time, then retest.

## Limitations

- One valid run per image variant on the latest code.
- k6 shared the Docker VM with the stack.
- The workload covers listing reads only; booking, payment, and rental flows are not loaded.
