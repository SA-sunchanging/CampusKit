import { ApiProperty } from '@nestjs/swagger';
import type { InboxEntryRecord } from './inbox-entry.schema.js';

/** One notice in the caller's inbox. Times are ISO-8601 UTC; readAt is empty while unread. */
export class InboxEntryResponse {
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ example: 'booking.confirmed' })
  type: string;

  @ApiProperty({
    description: 'ISO-8601 UTC; when the event happened.',
    example: '2026-10-29T08:00:00.000Z',
  })
  occurredAt: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The event data; its shape depends on type (see libs/contracts/src/events.ts).',
  })
  data: Record<string, unknown>;

  @ApiProperty()
  read: boolean;

  @ApiProperty({ description: 'ISO-8601 UTC; empty while unread.' })
  readAt: string;

  static of(entry: InboxEntryRecord): InboxEntryResponse {
    return Object.assign(new InboxEntryResponse(), {
      eventId: entry.eventId,
      type: entry.type,
      occurredAt: entry.occurredAt.toISOString(),
      data: entry.data ?? {},
      read: Boolean(entry.readAt),
      readAt: entry.readAt ? entry.readAt.toISOString() : '',
    });
  }
}

/** Body of GET /inbox. */
export class InboxListResponse {
  @ApiProperty({
    type: [InboxEntryResponse],
    description: 'At most 50, newest first.',
  })
  entries: InboxEntryResponse[];

  @ApiProperty({
    description: 'All unread entries of the caller, not only those listed.',
  })
  unread: number;

  static of(entries: InboxEntryRecord[], unread: number): InboxListResponse {
    return Object.assign(new InboxListResponse(), {
      entries: entries.map((entry) => InboxEntryResponse.of(entry)),
      unread,
    });
  }
}

/** Body of GET /inbox/unread-count and POST /inbox/read-all. */
export class UnreadCountResponse {
  @ApiProperty()
  unread: number;

  static of(unread: number): UnreadCountResponse {
    return Object.assign(new UnreadCountResponse(), { unread });
  }
}
