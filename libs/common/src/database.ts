import type { TypeOrmModuleOptions } from '@nestjs/typeorm';

type Migrations = NonNullable<TypeOrmModuleOptions['migrations']>;

/**
 * PostgreSQL settings for one service. Each service connects only to its own database.
 * Schema changes go through migrations (never synchronize), so Booking can add its exclusion constraint.
 */
export function postgresOptions(
  service: string,
  migrations: Migrations,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    url:
      process.env.DATABASE_URL ??
      `postgres://${service}_user:${service}_pass@localhost:5432/${service}_db`,
    autoLoadEntities: true,
    synchronize: false,
    migrations,
    migrationsRun: true,
  };
}

/** MongoDB connection string for one service. Each service connects only to its own database. */
export function mongoUrl(service: string): string {
  return (
    process.env.MONGO_URL ??
    `mongodb://${service}_user:${service}_pass@localhost:27017/${service}_db`
  );
}
