import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { CalendarClient } from '../clients/calendar.client.js';
import { SEED_COUNT } from './seed-data.js';
import { ownerCall, seedListings } from './seed-listings.js';
import { SeedModule } from './seed.module.js';

/** Entry for `node dist/apps/listing/main.js seed` (npm run seed:listing). Booking must be running. */
export async function runSeed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    const jwt = app.get(JwtService);
    const calendar = app.get(CalendarClient);
    const result = await seedListings(
      app.get(DataSource),
      async (listing) => {
        // Booking records the caller as the calendar owner, so act as the listing owner.
        const token = jwt.sign(
          { sub: listing.ownerId, role: 'student' },
          { expiresIn: 600 },
        );
        try {
          await calendar.setupCalendar(listing.id, [], ownerCall(token));
          return true;
        } catch (err) {
          logger.warn(`Calendar for ${listing.id}: ${String(err)}`);
          return false;
        }
      },
      SEED_COUNT,
    );
    logger.log(
      `Inserted ${result.inserted} new listings of ${SEED_COUNT}; ` +
        `${result.calendarFailures} calendar setups failed`,
    );
    if (result.calendarFailures > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}
