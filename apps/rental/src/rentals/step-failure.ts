import {
  ConflictException,
  type HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ServiceFailure } from '../clients/http-call.js';

/** Why a step of a handover did not go through: the text for last_error and the error to answer. */
export interface StepProblem {
  text: string;
  exception: HttpException;
}

/** "<Step> was declined: <message>" or "<Step> is unavailable: <message>". */
export function failureText(step: string, failure: ServiceFailure): string {
  return failure.reason === 'declined'
    ? `${step} was declined: ${failure.message}`
    : `${step} is unavailable: ${failure.message}`;
}

/** A failed call to another service: 409 when it refused, 503 when it may pass on a retry. */
export function stepProblem(
  step: string,
  failure: ServiceFailure,
): StepProblem {
  const text = failureText(step, failure);
  return {
    text,
    exception:
      failure.reason === 'declined'
        ? new ConflictException(text)
        : new ServiceUnavailableException(text),
  };
}

/** A rule this service checks itself, answered with 409. */
export function conflictProblem(text: string): StepProblem {
  return { text, exception: new ConflictException(text) };
}
