import {
  InternalAuthGuard,
  InternalCallers,
  SERVICE_TOKEN_HEADER,
} from '@app/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthorizeService } from '../ledger/authorize.js';
import { CaptureService } from '../ledger/capture.js';
import { SettleService } from '../ledger/settle.js';
import { VoidService } from '../ledger/void.js';
import { AuthorizeResponse } from './authorize.response.js';
import { CaptureResponse } from './capture.response.js';
import { AuthorizeDto } from './dto/authorize.dto.js';
import { CaptureDto } from './dto/capture.dto.js';
import { SettleDto } from './dto/settle.dto.js';
import { VoidDto } from './dto/void.dto.js';
import { SettleResponse } from './settle.response.js';
import { VoidResponse } from './void.response.js';

/**
 * Service-to-service endpoints for Booking and Rental. The gateway does not forward /internal
 * paths, and each route accepts only the service tokens of its callers
 * (docs/adr/adr-010-authenticate-internal-calls-with-service-tokens.md).
 * A refusal answers 400 or 409; reusing an operationId with another body answers 409.
 */
@ApiTags('internal')
@ApiHeader({ name: SERVICE_TOKEN_HEADER, required: true })
@UseGuards(InternalAuthGuard)
@Controller('internal/payments')
export class InternalPaymentsController {
  constructor(
    private readonly authorizer: AuthorizeService,
    private readonly capturer: CaptureService,
    private readonly voider: VoidService,
    private readonly settler: SettleService,
  ) {}

  @Post('authorize')
  @InternalCallers('booking')
  @ApiCreatedResponse({ type: AuthorizeResponse })
  authorize(@Body() dto: AuthorizeDto): Promise<AuthorizeResponse> {
    return this.authorizer.authorize(dto);
  }

  @Post('capture')
  @InternalCallers('rental')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CaptureResponse })
  capture(@Body() dto: CaptureDto): Promise<CaptureResponse> {
    return this.capturer.capture(dto);
  }

  @Post('void')
  @InternalCallers('booking')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: VoidResponse })
  voidOpen(@Body() dto: VoidDto): Promise<VoidResponse> {
    return this.voider.voidOpen(dto);
  }

  @Post('settle')
  @InternalCallers('rental')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SettleResponse })
  settle(@Body() dto: SettleDto): Promise<SettleResponse> {
    return this.settler.settle(dto);
  }
}
