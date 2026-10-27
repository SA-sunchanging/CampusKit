import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PasswordHasher } from '../passwords/password-hasher.js';
import { DEMO_PASSWORD } from './demo-accounts.js';
import { seedDemoAccounts } from './seed-demo-accounts.js';
import { SeedModule } from './seed.module.js';

/** Entry for `node dist/apps/identity/main.js seed` (npm run seed). */
export async function runSeed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    const seeded = await seedDemoAccounts(
      app.get(DataSource),
      app.get(PasswordHasher),
    );
    for (const account of seeded) {
      logger.log(`${account.role} ${account.email} (${account.id})`);
    }
    logger.log(`Password for every demo account: ${DEMO_PASSWORD}`);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
