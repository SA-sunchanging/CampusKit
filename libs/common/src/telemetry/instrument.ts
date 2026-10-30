/**
 * Starts OpenTelemetry before the service loads. The Dockerfile runs it with
 * `node --import ./telemetry/instrument.ts`, so Node strips the types and this file is not bundled:
 * it imports packages only, never a relative file, and uses erasable TypeScript syntax only.
 *
 * Traces go over OTLP/HTTP to OTEL_EXPORTER_OTLP_ENDPOINT (Jaeger in the stack); metrics are
 * served for Prometheus on OTEL_METRICS_PORT. OTEL_SDK_DISABLED=true turns everything off.
 */
import { register } from 'node:module';
import type { AsyncLocalStorage } from 'node:async_hooks';
import type { IncomingMessage } from 'node:http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace';
import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace';

// Copies of the values in correlation-context.ts, which this unbundled file cannot import; the
// spec checks that both sides agree.
export const CORRELATION_ATTRIBUTE = 'campuskit.correlation_id';
export const CORRELATION_STORE_KEY = Symbol.for('campuskit.correlation-store');

const DEFAULT_METRICS_PORT = 9464;

/** Health checks and metric scrapes would bury the real requests in Jaeger. */
const IGNORED_PATH = /(^|\/)(health|metrics)(\/|\?|$)/;

/** The correlation ID of the work in progress, read from the store the services fill. */
function currentCorrelationId(): string | undefined {
  const store = (globalThis as Record<symbol, unknown>)[
    CORRELATION_STORE_KEY
  ] as AsyncLocalStorage<string> | undefined;
  return store?.getStore();
}

/** Tags every span started inside a correlation run with the run's ID. */
export class CorrelationSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    const id = currentCorrelationId();
    if (id !== undefined) {
      span.setAttribute(CORRELATION_ATTRIBUTE, id);
    }
  }

  onEnd(): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/** True when an incoming request is a health check or a metric scrape. */
export function isIgnoredRequest(
  request: Pick<IncomingMessage, 'url'>,
): boolean {
  return IGNORED_PATH.test(request.url ?? '');
}

/** The metrics port from the environment; the Prometheus default when unset or invalid. */
export function metricsPort(env: NodeJS.ProcessEnv): number {
  const port = Number(env.OTEL_METRICS_PORT);
  return Number.isInteger(port) && port > 0 && port < 65536
    ? port
    : DEFAULT_METRICS_PORT;
}

/** Builds the SDK: auto-instrumentation without noisy file and network spans. */
export function createSdk(env: NodeJS.ProcessEnv): NodeSDK {
  return new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    spanProcessors: [
      new CorrelationSpanProcessor(),
      new BatchSpanProcessor({ exporter: new OTLPTraceExporter() }),
    ],
    metricReaders: [
      new PrometheusExporter({ host: '0.0.0.0', port: metricsPort(env) }),
    ],
    // Logs stay on stdout; without this the SDK would also ship them over OTLP, which Jaeger rejects.
    logRecordProcessors: [],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: isIgnoredRequest,
        },
        // A span per middleware (body parser, correlation, auth) hides the work that matters.
        // Express 5 routes through the router package, whose instrumentation cannot skip them.
        '@opentelemetry/instrumentation-express': {
          ignoreLayersType: [ExpressLayerType.MIDDLEWARE],
        },
        '@opentelemetry/instrumentation-router': { enabled: false },
        // The outbox relays poll every second outside any request; only queries inside a
        // traced request or event are worth a span.
        '@opentelemetry/instrumentation-pg': { requireParentSpan: true },
        '@opentelemetry/instrumentation-mongodb': { requireParentSpan: true },
      }),
    ],
  });
}

/** Hooks ES module loading and starts the SDK, unless OTEL_SDK_DISABLED is true. */
export function startTelemetry(env: NodeJS.ProcessEnv): NodeSDK | undefined {
  if (env.OTEL_SDK_DISABLED === 'true') {
    return undefined;
  }
  // The bundles import their packages as ES modules, which only this loader hook can patch.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const sdk = createSdk(env);
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
  return sdk;
}

startTelemetry(process.env);
