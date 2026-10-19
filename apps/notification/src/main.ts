import { createHttpService, envPort, listen } from '@app/common';
import { NotificationModule } from './notification.module.js';

async function bootstrap() {
  const app = await createHttpService(NotificationModule, 'notification');
  await listen(app, 'notification', envPort('PORT', 3006));
}
await bootstrap();
