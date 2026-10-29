import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthorizeService } from '../ledger/authorize.js';
import { CaptureService } from '../ledger/capture.js';
import { VoidService } from '../ledger/void.js';
import { AuthorizeResponse } from './authorize.response.js';
import { CaptureResponse } from './capture.response.js';
import { AuthorizeDto } from './dto/authorize.dto.js';
import { CaptureDto } from './dto/capture.dto.js';
import { VoidDto } from './dto/void.dto.js';
import { VoidResponse } from './void.response.js';

/**
 * Service-to-service endpoints for Booking and Rental. The gateway does not forward /internal
 * paths. Internal service authentication is still open (docs/architecture/services.md).
 * A refusal answers 400 or 409; reusing an operationId with another body answers 409.
 */
@ApiTags('internal')
@Controller('internal/payments')
export class InternalPaymentsController {
  constructor(
    private readonly authorizer: AuthorizeService,
    private readonly capturer: CaptureService,
    private readonly voider: VoidService,
  ) {}

  @Post('authorize')
  @ApiCreatedResponse({ type: AuthorizeResponse })
  authorize(@Body() dto: AuthorizeDto): Promise<AuthorizeResponse> {
    return this.authorizer.authorize(dto);
  }

  @Post('capture')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CaptureResponse })
  capture(@Body() dto: CaptureDto): Promise<CaptureResponse> {
    return this.capturer.capture(dto);
  }

  @Post('void')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VoidResponse })
  voidOpen(@Body() dto: VoidDto): Promise<VoidResponse> {
    return this.voider.voidOpen(dto);
  }
}
