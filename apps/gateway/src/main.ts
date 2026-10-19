import { createHttpService, envPort, listen } from '@app/common';
import { json } from 'express';
import { GatewayModule } from './gateway.module.js';
import { registerProxies } from './proxy.js';

async function bootstrap() {
  // The proxy forwards raw request bodies, so Nest's body parser is off and only the
  // gateway's own gRPC-backed routes parse JSON.
  const app = await createHttpService(GatewayModule, 'gateway', {
    bodyParser: false,
  });
  app.use('/api/booking', json());
  registerProxies(app);
  await listen(app, 'gateway', envPort('PORT', 3000));
}
await bootstrap();
