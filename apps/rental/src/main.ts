import { createHttpService, envPort, listen } from '@app/common';
import { RentalModule } from './rental.module.js';

async function bootstrap() {
  const app = await createHttpService(RentalModule, 'rental');
  await listen(app, 'rental', envPort('PORT', 3003));
}
await bootstrap();
