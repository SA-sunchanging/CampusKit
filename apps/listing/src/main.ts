import { createHttpService, envPort, listen } from '@app/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ListingModule } from './listing.module.js';
import { runSeed } from './seed/run-seed.js';

/** Up to five compressed photos travel inline as data URLs (no object storage yet). */
const BODY_LIMIT = '3mb';

async function bootstrap() {
  const app = (await createHttpService(
    ListingModule,
    'listing',
  )) as NestExpressApplication;
  app.useBodyParser('json', { limit: BODY_LIMIT });
  await listen(app, 'listing', envPort('PORT', 3002));
}
if (process.argv[2] === 'seed') {
  await runSeed();
} else {
  await bootstrap();
}
