import type { NextFunction, Request, Response } from 'express';
import { currentCorrelationId } from './correlation-context.js';
import {
  CORRELATION_HEADER,
  correlationId,
} from './correlation-id.middleware.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function run(given?: string) {
  const headers: Record<string, string> = {};
  if (given !== undefined) {
    headers[CORRELATION_HEADER] = given;
  }
  const req = {
    headers,
    header: (name: string) => headers[name],
  };
  const res = { setHeader: vi.fn() };
  const next = vi.fn(() => currentCorrelationId());
  correlationId(
    req as unknown as Request,
    res as unknown as Response,
    next as NextFunction,
  );
  const id = headers[CORRELATION_HEADER];
  return { id, res, next };
}

describe('correlationId', () => {
  it.each(['abc-123', 'f3b1c2d4-0000-4000-8000-000000000000', 'a.b_c'])(
    'keeps and echoes a valid caller ID %s',
    (given) => {
      const { id, res, next } = run(given);
      expect(id).toBe(given);
      expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, given);
      expect(next).toHaveBeenCalledOnce();
    },
  );

  it('creates a UUID when the caller sends none', () => {
    const { id, res } = run();
    expect(id).toMatch(UUID);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, id);
  });

  it.each([
    '',
    'a'.repeat(129),
    'has space',
    'line\r\nbreak',
    '<script>',
    'id;drop',
  ])('replaces the malformed caller ID %j with a new UUID', (given) => {
    const { id, res } = run(given);
    expect(id).toMatch(UUID);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, id);
  });

  it('accepts an ID of exactly 128 characters', () => {
    const given = 'a'.repeat(128);
    expect(run(given).id).toBe(given);
  });

  it('runs the rest of the request under the ID', () => {
    const { id, next } = run('corr-1');
    expect(id).toBe('corr-1');
    expect(next).toHaveReturnedWith('corr-1');
    expect(currentCorrelationId()).toBeUndefined();
  });
});
