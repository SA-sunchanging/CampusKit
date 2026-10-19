import { Controller, Get, NotImplementedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * REST endpoints of the notification service, reached through the gateway at /api/notification/inbox.
 * Operations owned by this service (see docs/architecture/services.md): list and mark inbox entries; the RabbitMQ consumer fills the inbox.
 */
@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  @Get()
  list(): never {
    throw new NotImplementedException();
  }
}
