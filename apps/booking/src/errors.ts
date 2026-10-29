import { status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { isUUID } from 'class-validator';
import { QueryFailedError } from 'typeorm';
import { CalendarInputError } from './calendar/date-range.js';

const EXCLUSION_VIOLATION = '23P01';

/** A gRPC error with a status code and a message the gateway passes to the client. */
export function rpcError(code: status, message: string): RpcException {
  return new RpcException({ code, message });
}

/** True when an insert or update broke the calendar_blocks no-overlap constraint. */
export function isExclusionViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string }).code === EXCLUSION_VIOLATION
  );
}

/** Throws INVALID_ARGUMENT unless the value is a UUID; proto3 sends a missing string as ''. */
export function requireUuid(value: string | undefined, field: string): void {
  if (!isUUID(value ?? '')) {
    throw rpcError(status.INVALID_ARGUMENT, `${field} must be a UUID`);
  }
}

/** Runs input parsing and turns a broken calendar rule into INVALID_ARGUMENT. */
export function parseInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (err) {
    if (err instanceof CalendarInputError) {
      throw rpcError(status.INVALID_ARGUMENT, err.message);
    }
    throw err;
  }
}
