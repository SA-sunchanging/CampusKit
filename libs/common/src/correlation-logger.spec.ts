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
});
