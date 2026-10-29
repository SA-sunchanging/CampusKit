import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { migrations } from '../migrations/index.js';

/**
 * A booking_db for one integration spec file: a fresh schema with a random name on the server in
 * TEST_DATABASE_URL, with the booking migrations applied. drop() removes the schema again.
 * Used only by *.integration.spec.ts files, which skip when TEST_DATABASE_URL is not set.
 */
export interface TestDatabase {
  db: DataSource;
  schema: string;
  drop(): Promise<void>;
}

/** Runs one statement on its own short-lived connection, outside the test schema. */
async function adminQuery(url: string, sql: string): Promise<void> {
  const admin = new DataSource({ type: 'postgres', url });
  await admin.initialize();
  try {
    await admin.query(sql);
  } finally {
    await admin.destroy();
  }
}

/**
 * The exclusion constraint needs btree_gist. infra/postgres/init.sql installs it in booking_db,
 * but the CI database starts without it. Two spec files installing it at once make one of them
 * fail with a unique violation (23505), which means it is installed.
 */
async function installBtreeGist(url: string): Promise<void> {
  try {
    await adminQuery(url, `CREATE EXTENSION IF NOT EXISTS btree_gist`);
  } catch (err) {
    if ((err as { code?: string }).code !== '23505') {
      throw err;
    }
  }
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set');
  }
  const schema = `booking_test_${randomBytes(6).toString('hex')}`;
  await installBtreeGist(url);
  await adminQuery(url, `CREATE SCHEMA ${schema}`);
  const db = new DataSource({
    type: 'postgres',
    url,
    schema,
    migrations,
    // public stays on the path for the btree_gist operator classes.
    extra: { options: `-c search_path=${schema},public` },
  });
  await db.initialize();
  await db.runMigrations();
  return {
    db,
    schema,
    drop: async () => {
      await db.destroy();
      await adminQuery(url, `DROP SCHEMA ${schema} CASCADE`);
    },
  };
}
