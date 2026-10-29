import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { conflictProblem, failureText, stepProblem } from './step-failure.js';

describe('step failures', () => {
  it('describes a refusal and answers 409', () => {
    const failure = {
      ok: false as const,
      reason: 'declined' as const,
      message: 'No fee',
    };
    expect(failureText('Fee capture', failure)).toBe(
      'Fee capture was declined: No fee',
    );
    const problem = stepProblem('Fee capture', failure);
    expect(problem.exception).toBeInstanceOf(ConflictException);
    expect(problem.exception.message).toBe(problem.text);
  });

  it('describes an outage and answers 503', () => {
    const problem = stepProblem('Settlement', {
      ok: false,
      reason: 'unavailable',
      message: 'The payment service is unavailable',
    });
    expect(problem.text).toBe(
      'Settlement is unavailable: The payment service is unavailable',
    );
    expect(problem.exception).toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers 409 for a rule of this service', () => {
    const problem = conflictProblem('The booking is not confirmed');
    expect(problem.exception).toBeInstanceOf(ConflictException);
    expect(problem.exception.message).toBe('The booking is not confirmed');
  });
});
