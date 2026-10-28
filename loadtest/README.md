# Load tests

k6 scripts for the two load-test types the course requires, on the Listing service's search and
detail endpoints, through the API gateway.

| Script | Type | Shape |
| --- | --- | --- |
| `smoke.js` | Smoke | 1 VU, 5 requests to `/health`; run first |
| `load.js` | Load | 0 to 300 VUs in 2 min, hold 300 for 5 min, ramp down 30 s |
| `stress.js` | Stress | Steps to 300, 600, and 1,000 VUs (2 min ramp, 2 min hold each), ramp down 1 min |

`lib.js` holds the shared request mix: 70% search (random keyword, category, both, or neither;
page 1-3) and 30% detail (random seeded listing), with 0.5-1.5 s think time.

## Targets

From the performance requirement in `docs/requirements.md`: 300 concurrent VUs against 1,500 listings, search p95 at
most 1 s, detail p95 at most 500 ms, and server errors below 0.5%. Both scripts use these as k6
thresholds. The stress test is expected to break them; it keeps running so the breaking point
shows in the results.

## Prerequisites

Install k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/) or use the `grafana/k6` Docker
image. Then start the stack and seed it from the repository root:

```sh
docker compose up --build
npm run seed          # Identity demo accounts
npm run seed:listing  # 1,500 listings and their Booking calendars
```

## Run

From the repository root, so the summary files land in `loadtest/results/`:

```sh
k6 run loadtest/smoke.js
k6 run loadtest/load.js
k6 run loadtest/stress.js
```

With Docker, mount the folder so `handleSummary` can write the results. `--user` lets the
container write to the mounted folder on Linux:

```sh
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/loadtest:/loadtest" -w / grafana/k6 run /loadtest/load.js
```

For a quick run without result files, `docker run --rm -i --network host grafana/k6 run - <loadtest/smoke.js`
works for `smoke.js` only, because `load.js` and `stress.js` import `lib.js`.

The gateway defaults to `http://localhost:3000`. Override it with `BASE_URL`:

```sh
k6 run -e BASE_URL=http://192.168.1.20:3000 loadtest/load.js
```

## Results

`load.js` and `stress.js` write `loadtest/results/load-summary.json` and
`loadtest/results/stress-summary.json` and print the text summary. Commit the JSON files after
each run so the slides can cite them, and fill in `loadtest/results.md` with the settings,
numbers, and interpretation.
