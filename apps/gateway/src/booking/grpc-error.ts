import { status } from '@grpc/grpc-js';
import { HttpException, HttpStatus } from '@nestjs/common';
import { TimeoutError } from 'rxjs';

const httpStatusByGrpcCode: Partial<Record<number, HttpStatus>> = {
  [status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [status.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [status.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [status.FAILED_PRECONDITION]: HttpStatus.CONFLICT,
  [status.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [status.DEADLINE_EXCEEDED]: HttpStatus.GATEWAY_TIMEOUT,
};

const TIMEOUT_MESSAGE = 'The booking service did not answer in time';

/** Converts an error from a gRPC call, or the gateway's own timeout, into the matching HTTP error. */
export function toHttpError(error: unknown): HttpException {
  if (error instanceof TimeoutError) {
    return new HttpException(TIMEOUT_MESSAGE, HttpStatus.GATEWAY_TIMEOUT);
  }
  const { code, details } = error as { code?: number; details?: string };
  if (code === status.DEADLINE_EXCEEDED) {
    return new HttpException(TIMEOUT_MESSAGE, HttpStatus.GATEWAY_TIMEOUT);
  }
  const httpStatus =
    (code !== undefined && httpStatusByGrpcCode[code]) ||
    HttpStatus.BAD_GATEWAY;
  return new HttpException(details ?? 'Booking service error', httpStatus);
}
