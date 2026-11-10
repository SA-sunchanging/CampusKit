// Stress test: steps past the planned test load (300 -> 600 -> 1000 VUs) to find the breaking point.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { PERFORMANCE_THRESHOLDS, visit } from './lib.js';

// Same targets as the load test, but the run continues when they fail: the point is to see where.
const thresholds = Object.fromEntries(
  Object.entries(PERFORMANCE_THRESHOLDS).map(([metric, rules]) => [
    metric,
    rules.map((threshold) => ({ threshold, abortOnFail: false })),
  ]),
);

export const options = {
  stages: [
    { duration: '2m', target: 300 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 600 },
    { duration: '2m', target: 600 },
    { duration: '2m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds,
};

export default function () {
  visit();
}

export function handleSummary(data) {
  return {
    'loadtest/results/run-2.g8nAt9/stress-summary-2.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
