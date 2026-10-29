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

/**
 * The outcome of a call whose failure the caller records instead of throwing. "declined" is a
 * definitive refusal (4xx); "unavailable" means the call may succeed when retried.
 */
export type ServiceResult<T> = { ok: true; value: T } | ServiceFailure;

export interface ServiceFailure {
  ok: false;
  reason: 'declined' | 'unavailable';
  message: string;
}

export interface ResultCall<T> {
  /** Service name for messages, for example "payment". */
  service: string;
  url: string;
  body: unknown;
  correlationId: string;
  isValid: (body: unknown) => body is T;
}

/**
 * POSTs JSON and classifies the reply. A 2xx with a valid body is ok. 404 and 501 (endpoint
 * not built yet), 5xx, an invalid body, timeouts and network failures are unavailable. Any
 * other 4xx is declined, with the service's message.
 */
export async function postForResult<T>(
  call: ResultCall<T>,
  logger: Logger,
): Promise<ServiceResult<T>> {
  const reply = await send(
    {
      method: 'POST',
      url: call.url,
      body: call.body,
      correlationId: call.correlationId,
    },
    logger,
  );
  if (isSuccess(reply) && call.isValid(reply.body)) {
    return { ok: true, value: reply.body };
  }
  if (
    reply !== undefined &&
    reply.status >= 400 &&
    reply.status < 500 &&
    reply.status !== 404
  ) {
    return {
      ok: false,
      reason: 'declined',
      message:
        errorMessage(reply.body) ??
        `The ${call.service} service refused the request (HTTP ${reply.status})`,
    };
  }
  return {
    ok: false,
    reason: 'unavailable',
    message: `The ${call.service} service is unavailable`,
  };
}
