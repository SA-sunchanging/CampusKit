import { createHttpService, envPort, listen } from '@app/common';
import { PaymentModule } from './payment.module.js';

async function bootstrap() {
  const app = await createHttpService(PaymentModule, 'payment');
  await listen(app, 'payment', envPort('PORT', 3004));
}
await bootstrap();
