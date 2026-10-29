import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { AuthorizeService } from '../ledger/authorize.js';
import { AuthorizeResponse } from './authorize.response.js';
import { AuthorizeDto } from './dto/authorize.dto.js';

/**
 * Service-to-service endpoints for Booking and Rental. The gateway does not forward /internal
 * paths. Internal service authentication is still open (docs/architecture/services.md).
 * A refusal answers 400 or 409; reusing an operationId with another body answers 409.
 */
@ApiTags('internal')
@Controller('internal/payments')
export class InternalPaymentsController {
  constructor(private readonly authorizer: AuthorizeService) {}

  @Post('authorize')
  @ApiCreatedResponse({ type: AuthorizeResponse })
  authorize(@Body() dto: AuthorizeDto): Promise<AuthorizeResponse> {
    return this.authorizer.authorize(dto);
  }
}
