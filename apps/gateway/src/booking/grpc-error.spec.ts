import { status } from '@grpc/grpc-js';
import { HttpStatus } from '@nestjs/common';
import { TimeoutError } from 'rxjs';
import { toHttpError } from './grpc-error.js';

describe('toHttpError', () => {
  it.each([
    [status.INVALID_ARGUMENT, HttpStatus.BAD_REQUEST],
    [status.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED],
    [status.PERMISSION_DENIED, HttpStatus.FORBIDDEN],
    [status.NOT_FOUND, HttpStatus.NOT_FOUND],
    [status.ALREADY_EXISTS, HttpStatus.CONFLICT],
    [status.FAILED_PRECONDITION, HttpStatus.CONFLICT],
    [status.UNIMPLEMENTED, HttpStatus.NOT_IMPLEMENTED],
    [status.UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE],
  ])('maps gRPC code %i to HTTP %i with the details', (code, httpStatus) => {
    const error = toHttpError({ code, details: 'why' });
    expect(error.getStatus()).toBe(httpStatus);
    expect(error.getResponse()).toBe('why');
  });

  it('answers 502 for an unexpected error', () => {
    const error = toHttpError(new Error('boom'));
    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(error.getResponse()).toBe('Booking service error');
  });

  it.each([
    ['the gateway timeout', new TimeoutError()],
    ['DEADLINE_EXCEEDED', { code: status.DEADLINE_EXCEEDED, details: 'late' }],
  ])('answers 504 for %s', (_name, error) => {
    const httpError = toHttpError(error);
    expect(httpError.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(httpError.getResponse()).toBe(
      'The booking service did not answer in time',
    );
  });
});
