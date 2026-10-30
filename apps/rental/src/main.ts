import { createHttpService, envPort, listen } from '@app/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RentalModule } from './rental.module.js';

/** Up to three compressed evidence photos travel inline as data URLs (no object storage yet). */
const BODY_LIMIT = '2mb';

async function bootstrap() {
  const app = (await createHttpService(
    RentalModule,
    'rental',
  )) as NestExpressApplication;
  app.useBodyParser('json', { limit: BODY_LIMIT });
  await listen(app, 'rental', envPort('PORT', 3003));
}
await bootstrap();
