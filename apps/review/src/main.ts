import { createHttpService, envPort, listen } from '@app/common';
import { ReviewModule } from './review.module.js';

async function bootstrap() {
  const app = await createHttpService(ReviewModule, 'review');
  await listen(app, 'review', envPort('PORT', 3005));
}
await bootstrap();
