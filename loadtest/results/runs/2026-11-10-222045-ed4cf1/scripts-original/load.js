// Load test: 300 concurrent VUs (the planned test load) on Listing search and detail via the gateway.
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { PERFORMANCE_THRESHOLDS, visit } from './lib.js';

export const options = {
  stages: [
    { duration: '2m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '30s', target: 0 },
  ],
  thresholds: PERFORMANCE_THRESHOLDS,
};

export default function () {
  visit();
}

export function handleSummary(data) {
  return {
    'loadtest/results/load-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
