import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { migrations } from '../migrations/index.js';

/**
 * A listing_db for one integration spec file: a fresh schema with a random name on the server in
 * TEST_DATABASE_URL, with the listing migrations applied. drop() removes the schema again.
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

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set');
  }
  const schema = `listing_test_${randomBytes(6).toString('hex')}`;
  await adminQuery(url, `CREATE SCHEMA ${schema}`);
  const db = new DataSource({
    type: 'postgres',
    url,
    schema,
    migrations,
    extra: { options: `-c search_path=${schema}` },
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
