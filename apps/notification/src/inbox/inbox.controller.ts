import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InboxQueriesService } from './inbox-queries.service.js';
import {
  InboxEntryResponse,
  InboxListResponse,
  UnreadCountResponse,
} from './inbox.response.js';

/**
 * REST endpoints of the notification service, reached through the gateway at /api/notification/inbox.
 * Operations owned by this service (see docs/architecture/services.md): list and mark inbox entries;
 * the RabbitMQ consumer fills the inbox. A caller only sees and marks their own entries.
 */
@ApiTags('inbox')
@Controller('inbox')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InboxController {
  constructor(private readonly queries: InboxQueriesService) {}

  /** The caller's newest 50 entries and the count of all their unread entries. */
  @Get()
  @ApiOkResponse({ type: InboxListResponse })
  list(@CurrentUser() user: AuthUser): Promise<InboxListResponse> {
    return this.queries.list(user);
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountResponse })
  unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountResponse> {
    return this.queries.unreadCount(user);
  }

  /** Marks every unread entry of the caller read. */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UnreadCountResponse })
  markAllRead(@CurrentUser() user: AuthUser): Promise<UnreadCountResponse> {
    return this.queries.markAllRead(user);
  }

  /** Marks one entry read; repeating it keeps the first readAt. */
  @Post(':eventId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InboxEntryResponse })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<InboxEntryResponse> {
    return this.queries.markRead(user, eventId);
  }
}
