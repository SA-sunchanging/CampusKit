import { metrics, type Attributes } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

/**
 * For specs only; not exported from the index, because the SDK it uses is a dev dependency.
 * A reader that collects on demand.
 */
class OnDemandReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export interface RecordedPoint {
  attributes: Attributes;
  value: unknown;
}

export interface MetricRecorder {
  /** Collects now and returns the points of one metric; empty when it has none. */
  points(name: string): Promise<RecordedPoint[]>;
  /** Removes the global meter provider again. */
  stop(): Promise<void>;
}

/** Installs a global meter provider, so code under test that uses the metrics API is recorded. */
export function recordMetrics(): MetricRecorder {
  const reader = new OnDemandReader();
  const provider = new MeterProvider({ readers: [reader] });
  metrics.setGlobalMeterProvider(provider);
  return {
    async points(name) {
      const { resourceMetrics } = await reader.collect();
      const metric = resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .find((m) => m.descriptor.name === name);
      return (metric?.dataPoints ?? []).map((point) => ({
        attributes: point.attributes,
        value: point.value,
      }));
    },
    async stop() {
      metrics.disable();
      await provider.shutdown();
    },
  };
}
