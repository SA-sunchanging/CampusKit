// Same request mix as the project benchmark, with shorter equal A/B stages.
import { PERFORMANCE_THRESHOLDS, visit } from './lib.js';

export const options = {
  stages: [
    { duration: '30s', target: 600 },
    { duration: '75s', target: 600 },
    { duration: '15s', target: 0 },
  ],
  thresholds: PERFORMANCE_THRESHOLDS,
};

export default function () { visit(); }

export function handleSummary(data) {
  return { [`/output/${__ENV.DIAG_PROFILE}-summary.json`]: JSON.stringify(data, null, 2) };
}
