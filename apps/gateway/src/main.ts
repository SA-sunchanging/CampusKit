import { createHttpService, envPort, listen } from '@app/common';
import { GatewayModule } from './gateway.module.js';
import { configureGateway } from './gateway.setup.js';

async function bootstrap() {
  // The proxy forwards raw request bodies, so Nest's body parser is off.
  const app = await createHttpService(GatewayModule, 'gateway', {
    bodyParser: false,
  });
  configureGateway(app);
  await listen(app, 'gateway', envPort('PORT', 3000));
}
await bootstrap();
