import { createHttpService, envPort, listen } from '@app/common';
import { IdentityModule } from './identity.module.js';

async function bootstrap() {
  const app = await createHttpService(IdentityModule, 'identity');
  await listen(app, 'identity', envPort('PORT', 3001));
}
await bootstrap();
