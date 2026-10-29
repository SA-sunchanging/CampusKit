import {
  Controller,
  Get,
  type INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import request from 'supertest';
import { createHttpService } from './bootstrap.js';
import { currentCorrelationId } from './correlation-context.js';
import { CORRELATION_HEADER } from './correlation-id.middleware.js';

@Controller('probe')
class ProbeController {
  @Get()
  get(): { id?: string } {
    return { id: currentCorrelationId() };
  }

  /** Reads the ID after the body parser and an await, where a lost context would show. */
  @Post()
  async post(): Promise<{ id?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return { id: currentCorrelationId() };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

let app: INestApplication;

beforeAll(async () => {
  app = await createHttpService(ProbeModule, 'probe');
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('createHttpService', () => {
  it("runs a handler under the caller's correlation ID", async () => {
    const res = await request(app.getHttpServer())
      .get('/probe')
      .set(CORRELATION_HEADER, 'corr-1');
    expect(res.body).toEqual({ id: 'corr-1' });
    expect(res.headers[CORRELATION_HEADER]).toBe('corr-1');
  });

  it('keeps the ID through the body parser and awaits', async () => {
    const res = await request(app.getHttpServer())
      .post('/probe')
      .set(CORRELATION_HEADER, 'corr-2')
      .send({ hello: 'world' });
    expect(res.body).toEqual({ id: 'corr-2' });
  });

  it('runs a request without an ID under the one it echoes', async () => {
    const res = await request(app.getHttpServer()).get('/probe');
    expect(res.body).toEqual({ id: res.headers[CORRELATION_HEADER] });
  });
});
