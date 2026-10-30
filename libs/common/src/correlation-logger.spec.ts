import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { runWithCorrelationId } from './correlation-context.js';
import { CorrelationLogger } from './correlation-logger.js';

/** Captures what the logger writes to stdout. */
function capture(write: () => void): string {
  const lines: string[] = [];
  const spy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    });
  try {
    write();
  } finally {
    spy.mockRestore();
  }
  return lines.join('');
}

describe('CorrelationLogger', () => {
  describe('text mode', () => {
    const logger = new CorrelationLogger({ colors: false });

    it('adds the ID after the context inside a run', () => {
      const line = capture(() =>
        runWithCorrelationId('corr-1', () =>
          logger.log('Booking requested', 'BookingsService'),
        ),
      );
      expect(line).toContain(
        '[BookingsService] [cid=corr-1] Booking requested',
      );
    });

    it('adds the ID when the line has no context', () => {
      const line = capture(() =>
        runWithCorrelationId('corr-2', () => logger.warn('Slow call')),
      );
      expect(line).toContain('[cid=corr-2] Slow call');
    });

    it('leaves a line outside any run unchanged', () => {
      const line = capture(() => logger.log('Listening', 'Bootstrap'));
      expect(line).toContain('[Bootstrap] Listening');
      expect(line).not.toContain('cid=');
    });
  });

  describe('JSON mode', () => {
    const logger = new CorrelationLogger({ json: true, colors: false });

    it('adds a correlationId field inside a run', () => {
      const line = capture(() =>
        runWithCorrelationId('corr-3', () => logger.log('Stored', 'Inbox')),
      );
      expect(JSON.parse(line)).toMatchObject({
        message: 'Stored',
        context: 'Inbox',
        correlationId: 'corr-3',
      });
    });

    it('has no correlationId field outside a run', () => {
      const line = capture(() => logger.log('Stored', 'Inbox'));
      expect(JSON.parse(line)).not.toHaveProperty('correlationId');
    });
  });

  describe('inside a traced span', () => {
    const tracer = new TracerProvider().getTracer('test');
    const contextManager = new AsyncLocalStorageContextManager();

    beforeAll(() => context.setGlobalContextManager(contextManager.enable()));
    afterAll(() => context.disable());

    /** Runs fn inside a recording span and returns the span's trace ID with fn's output. */
    function traced(fn: () => void): { traceId: string; line: string } {
      return tracer.startActiveSpan('work', (span) => {
        const line = capture(fn);
        span.end();
        return { traceId: span.spanContext().traceId, line };
      });
    }

    it('adds the trace ID after the correlation ID in text mode', () => {
      const logger = new CorrelationLogger({ colors: false });
      const { traceId, line } = traced(() =>
        runWithCorrelationId('corr-4', () => logger.log('Paid', 'Payment')),
      );
      expect(line).toContain(`[Payment] [cid=corr-4] [trace=${traceId}] Paid`);
    });

    it('adds a traceId field in JSON mode', () => {
      const logger = new CorrelationLogger({ json: true, colors: false });
      const { traceId, line } = traced(() => logger.log('Paid', 'Payment'));
      expect(JSON.parse(line)).toMatchObject({ message: 'Paid', traceId });
    });

    it('has no trace ID outside a span', () => {
      const logger = new CorrelationLogger({ colors: false });
      expect(trace.getActiveSpan()).toBeUndefined();
      expect(capture(() => logger.log('Idle', 'Relay'))).not.toContain(
        'trace=',
      );
    });
  });
});
