import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import {
  CORRELATION_SPAN_ATTRIBUTE,
  runWithCorrelationId,
} from '../correlation-context.js';

// Importing the file runs it; the switch keeps the SDK and the loader hook off in tests.
vi.stubEnv('OTEL_SDK_DISABLED', 'true');
const telemetry = await import('./instrument.js');
vi.unstubAllEnvs();

describe('telemetry instrument', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [
      new telemetry.CorrelationSpanProcessor(),
      new SimpleSpanProcessor({ exporter }),
    ],
  });
  const tracer = provider.getTracer('test');
  const contextManager = new AsyncLocalStorageContextManager();

  beforeAll(() => context.setGlobalContextManager(contextManager.enable()));
  afterAll(() => context.disable());
  afterEach(() => exporter.reset());

  /** The correlation attribute of a finished span; the exporter receives spans asynchronously. */
  async function attributeOf(name: string): Promise<unknown> {
    await provider.forceFlush();
    const span = exporter.getFinishedSpans().find((s) => s.name === name);
    expect(span).toBeDefined();
    return span?.attributes[CORRELATION_SPAN_ATTRIBUTE];
  }

  it('agrees with correlation-context on the attribute and the store', async () => {
    expect(telemetry.CORRELATION_ATTRIBUTE).toBe(CORRELATION_SPAN_ATTRIBUTE);
    await runWithCorrelationId('corr-store', async () => {
      tracer.startSpan('inside').end();
    });
    expect(await attributeOf('inside')).toBe('corr-store');
  });

  it('tags spans started inside a run, and their children', async () => {
    runWithCorrelationId('corr-1', () =>
      tracer.startActiveSpan('parent', (parent) => {
        tracer.startSpan('child').end();
        parent.end();
      }),
    );
    expect(await attributeOf('parent')).toBe('corr-1');
    expect(await attributeOf('child')).toBe('corr-1');
  });

  it('tags the open span when a run starts inside it', async () => {
    tracer.startActiveSpan('request', (span) => {
      runWithCorrelationId('corr-2', () => undefined);
      span.end();
    });
    expect(await attributeOf('request')).toBe('corr-2');
  });

  it('leaves spans outside any run untagged', async () => {
    tracer.startSpan('outside').end();
    expect(await attributeOf('outside')).toBeUndefined();
  });

  it.each(['/health', '/api/listing/health', '/metrics', '/health?x=1'])(
    'ignores %s',
    (url) => expect(telemetry.isIgnoredRequest({ url })).toBe(true),
  );

  it.each(['/api/listing/listings', '/healthy', '/api/booking/bookings'])(
    'traces %s',
    (url) => expect(telemetry.isIgnoredRequest({ url })).toBe(false),
  );

  it.each([
    [undefined, 9464],
    ['9500', 9500],
    ['abc', 9464],
    ['0', 9464],
    ['70000', 9464],
  ])('reads metrics port %j as %i', (value, port) => {
    expect(telemetry.metricsPort({ OTEL_METRICS_PORT: value })).toBe(port);
  });

  it('starts nothing when OTEL_SDK_DISABLED is true', () => {
    expect(
      telemetry.startTelemetry({ OTEL_SDK_DISABLED: 'true' }),
    ).toBeUndefined();
  });
});
