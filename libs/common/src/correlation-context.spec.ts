import { setTimeout as sleep } from 'node:timers/promises';
import {
  correlationIdFrom,
  currentCorrelationId,
  runWithCorrelationId,
} from './correlation-context.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('correlation context', () => {
  it('has no ID outside a run', () => {
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('keeps the ID across awaits and timers inside a run', async () => {
    const seen = await runWithCorrelationId('corr-1', async () => {
      await sleep(1);
      const later = await new Promise<string | undefined>((resolve) =>
        setTimeout(() => resolve(currentCorrelationId()), 1),
      );
      return [currentCorrelationId(), later];
    });
    expect(seen).toEqual(['corr-1', 'corr-1']);
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('lets a nested run override the ID until it ends', async () => {
    const seen = await runWithCorrelationId('outer', async () => {
      const inner = await runWithCorrelationId('inner', async () => {
        await sleep(1);
        return currentCorrelationId();
      });
      return [inner, currentCorrelationId()];
    });
    expect(seen).toEqual(['inner', 'outer']);
  });

  it('keeps concurrent runs apart', async () => {
    const run = (id: string, wait: number) =>
      runWithCorrelationId(id, async () => {
        await sleep(wait);
        return currentCorrelationId();
      });
    await expect(
      Promise.all([run('a', 5), run('b', 1), run('c', 3)]),
    ).resolves.toEqual(['a', 'b', 'c']);
  });
});

describe('correlationIdFrom', () => {
  it.each(['abc-123', 'a.b_c', 'a'.repeat(128)])('keeps %s', (value) => {
    expect(correlationIdFrom(value)).toBe(value);
  });

  it.each([
    undefined,
    42,
    '',
    'a'.repeat(129),
    'has space',
    'line\r\nbreak',
    '<script>',
  ])('replaces %j with a new UUID', (value) => {
    expect(correlationIdFrom(value)).toMatch(UUID);
  });
});
