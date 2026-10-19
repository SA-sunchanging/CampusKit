import { status } from '@grpc/grpc-js';
import { HttpException, HttpStatus } from '@nestjs/common';

const httpStatusByGrpcCode: Partial<Record<number, HttpStatus>> = {
  [status.INVALID_ARGUMENT]: HttpStatus.BAD_REQUEST,
  [status.UNAUTHENTICATED]: HttpStatus.UNAUTHORIZED,
  [status.PERMISSION_DENIED]: HttpStatus.FORBIDDEN,
  [status.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [status.ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [status.FAILED_PRECONDITION]: HttpStatus.CONFLICT,
  [status.UNIMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
  [status.UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Converts an error from a gRPC call into the matching HTTP error. */
export function toHttpError(error: unknown): HttpException {
  const { code, details } = error as { code?: number; details?: string };
  const httpStatus =
    (code !== undefined && httpStatusByGrpcCode[code]) ||
    HttpStatus.BAD_GATEWAY;
  return new HttpException(details ?? 'Booking service error', httpStatus);
}
