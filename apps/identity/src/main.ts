import { createHttpService, envPort, listen } from '@app/common';
import { IdentityModule } from './identity.module.js';
import { runSeed } from './seed/run-seed.js';

async function bootstrap() {
  const app = await createHttpService(IdentityModule, 'identity');
  await listen(app, 'identity', envPort('PORT', 3001));
}

if (process.argv[2] === 'seed') {
  await runSeed();
} else {
  await bootstrap();
}
