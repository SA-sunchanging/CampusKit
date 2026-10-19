# Load tests

k6 scripts for the load tests the course requires (at least two types, for example load and stress).
Run against the gateway of the full stack (`docker compose up --build`):

```sh
k6 run loadtest/smoke.js
```

Targets come from `docs/requirements.md`. Record each run's settings and results next to its script.
