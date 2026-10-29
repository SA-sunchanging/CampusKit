import { CORRELATION_HEADER } from '@app/common';
import type { Logger } from '@nestjs/common';

/** A service answers within this time or counts as unavailable. */
export const TIMEOUT_MS = 5_000;

export interface HttpRequest {
  method: 'GET' | 'POST';
  url: string;
  correlationId: string;
  /** Sent as JSON when set. */
  body?: unknown;
}

export interface HttpReply {
  status: number;
  /** The parsed JSON body, or undefined when the body is not JSON. */
  body: unknown;
}

/**
 * Sends one request with the correlation ID header. Returns undefined when the service cannot
 * be reached or does not answer within TIMEOUT_MS; the caller decides what a status means.
 */
export async function send(
  request: HttpRequest,
  logger: Logger,
): Promise<HttpReply | undefined> {
  const headers: Record<string, string> = {
    [CORRELATION_HEADER]: request.correlationId,
  };
  if (request.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers,
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body: unknown = await res.json().catch(() => undefined);
    if (!res.ok) {
      logger.warn(`${request.method} ${request.url} answered ${res.status}`);
    }
    return { status: res.status, body };
  } catch (err) {
    logger.warn(`${request.method} ${request.url} failed: ${String(err)}`);
    return undefined;
  }
}

/** True for a 2xx reply. */
export function isSuccess(reply: HttpReply | undefined): reply is HttpReply {
  return reply !== undefined && reply.status >= 200 && reply.status < 300;
}

/** The message of the shared error shape { error: { code, message } }, if the body has one. */
export function errorMessage(body: unknown): string | undefined {
  const message = (body as { error?: { message?: unknown } } | undefined)?.error
    ?.message;
  return typeof message === 'string' && message !== '' ? message : undefined;
}
