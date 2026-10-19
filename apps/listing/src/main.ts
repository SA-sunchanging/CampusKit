import { createHttpService, envPort, listen } from '@app/common';
import { ListingModule } from './listing.module.js';

async function bootstrap() {
  const app = await createHttpService(ListingModule, 'listing');
  await listen(app, 'listing', envPort('PORT', 3002));
}
await bootstrap();
