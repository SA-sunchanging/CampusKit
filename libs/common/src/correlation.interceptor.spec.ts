import { Metadata } from '@grpc/grpc-js';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { defer, firstValueFrom, of } from 'rxjs';
import { currentCorrelationId } from './correlation-context.js';
import { CORRELATION_HEADER } from './correlation-id.middleware.js';
import { CorrelationInterceptor } from './correlation.interceptor.js';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function httpContext(headers: Record<string, string>): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function rpcContext(metadata: Metadata): ExecutionContext {
  return {
    getType: () => 'rpc',
    switchToRpc: () => ({ getContext: () => metadata }),
  } as unknown as ExecutionContext;
}

/** A handler that reports the correlation ID it runs under, called at handle() like Nest's. */
const handler: CallHandler = {
  handle: () => {
    const id = currentCorrelationId();
    return defer(() => of(id));
  },
};

const run = (context: ExecutionContext) =>
  firstValueFrom(new CorrelationInterceptor().intercept(context, handler));

describe('CorrelationInterceptor', () => {
  it('runs an HTTP handler under the request header', async () => {
    await expect(
      run(httpContext({ [CORRELATION_HEADER]: 'corr-1' })),
    ).resolves.toBe('corr-1');
  });

  it('gives an HTTP request without an ID a new one and writes it back', async () => {
    const headers: Record<string, string> = {};
    const id = await run(httpContext(headers));
    expect(id).toMatch(UUID);
    expect(headers[CORRELATION_HEADER]).toBe(id);
  });

  it('runs a gRPC handler under the call metadata', async () => {
    const metadata = new Metadata();
    metadata.set(CORRELATION_HEADER, 'corr-2');
    await expect(run(rpcContext(metadata))).resolves.toBe('corr-2');
  });

  it('replaces a malformed gRPC ID and writes the new one back', async () => {
    const metadata = new Metadata();
    metadata.set(CORRELATION_HEADER, 'bad id');
    const id = await run(rpcContext(metadata));
    expect(id).toMatch(UUID);
    expect(metadata.get(CORRELATION_HEADER)).toEqual([id]);
  });

  it('leaves no ID behind after the handler', async () => {
    await run(httpContext({ [CORRELATION_HEADER]: 'corr-3' }));
    expect(currentCorrelationId()).toBeUndefined();
  });
});
