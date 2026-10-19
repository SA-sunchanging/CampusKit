import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the rental service, reached through the gateway at /api/rental/rentals.
 * Operations owned by this service (see docs/architecture/services.md): pickup and return evidence and codes, confirm pickup and return, settlement and retry, scheduled overdue checks and reminders.
 */
@ApiTags('rentals')
@Controller('rentals')
export class RentalsController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
