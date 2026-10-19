import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the listing service, reached through the gateway at /api/listing/listings.
 * Operations owned by this service (see docs/architecture/services.md): create safe DRAFT, search, detail, quote, moderation, publish and unpublish.
 */
@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
