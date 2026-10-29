import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { currentCorrelationId } from './correlation-context.js';
import { CORRELATION_HEADER } from './correlation-id.middleware.js';
import { ErrorFilter } from './error.filter.js';

function respond(exception: unknown, headers: Record<string, string> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ headers }),
    }),
  } as unknown as ArgumentsHost;
  new ErrorFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0] as number,
    body: res.json.mock.calls[0][0] as unknown,
  };
}

describe('ErrorFilter', () => {
  it('shapes an HttpException with its status name as the code', () => {
    expect(respond(new NotFoundException('Account not found'))).toEqual({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Account not found' } },
    });
  });

  it('joins validation messages into one string', () => {
    const { body } = respond(
      new BadRequestException(['email must be an email', 'password too short']),
    );
    expect(body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'email must be an email; password too short',
      },
    });
  });

  it('keeps a plain string response', () => {
    const { body } = respond(new HttpException('Nope', HttpStatus.FORBIDDEN));
    expect(body).toEqual({ error: { code: 'FORBIDDEN', message: 'Nope' } });
  });

  it('hides the details of an unexpected error behind a 500', () => {
    expect(respond(new Error('db password is hunter2'))).toEqual({
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error',
        },
      },
    });
  });

  describe('logging', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    function spyOnErrors() {
      const ids: (string | undefined)[] = [];
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
        ids.push(currentCorrelationId());
      });
      return ids;
    }

    it("logs an unexpected error under the request's correlation ID", () => {
      const ids = spyOnErrors();
      respond(new InternalServerErrorException(), {
        [CORRELATION_HEADER]: 'corr-1',
      });
      expect(ids).toEqual(['corr-1']);
    });

    it('logs without an ID when the request has none', () => {
      const ids = spyOnErrors();
      respond(new Error('boom'));
      expect(ids).toEqual([undefined]);
    });

    it('does not log a client error', () => {
      const ids = spyOnErrors();
      respond(new NotFoundException());
      expect(ids).toEqual([]);
    });
  });
});
