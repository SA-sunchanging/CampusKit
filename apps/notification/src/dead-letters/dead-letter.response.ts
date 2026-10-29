import { ApiProperty } from '@nestjs/swagger';
import type { DeadLetterRecord } from './dead-letter.schema.js';

/**
 * One dead-lettered message. Times are ISO-8601 UTC. Text fields the message did not carry are
 * empty; count is 0 when RabbitMQ gave none.
 */
export class DeadLetterResponse {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'booking.requested' })
  routingKey: string;

  @ApiProperty({ description: 'From the body; empty when it has none.' })
  eventId: string;

  @ApiProperty({ description: 'From the body; empty when it has none.' })
  type: string;

  @ApiProperty({ description: 'From the body; empty when it has none.' })
  correlationId: string;

  @ApiProperty({ example: 'rejected' })
  reason: string;

  @ApiProperty({ example: 'notification.inbox' })
  queue: string;

  @ApiProperty()
  count: number;

  @ApiProperty({
    description: 'When RabbitMQ first dead-lettered it; empty when unknown.',
  })
  deadLetteredAt: string;

  @ApiProperty({ example: '2026-10-29T08:00:00.000Z' })
  receivedAt: string;

  @ApiProperty({
    description: 'The body as text, cut to 65,536 characters.',
  })
  content: string;

  @ApiProperty({ description: 'The length of the whole body in bytes.' })
  size: number;

  static of(letter: DeadLetterRecord): DeadLetterResponse {
    return Object.assign(new DeadLetterResponse(), {
      id: letter._id.toString(),
      routingKey: letter.routingKey,
      eventId: letter.eventId ?? '',
      type: letter.type ?? '',
      correlationId: letter.correlationId ?? '',
      reason: letter.reason ?? '',
      queue: letter.queue ?? '',
      count: letter.count ?? 0,
      deadLetteredAt: letter.deadLetteredAt?.toISOString() ?? '',
      receivedAt: letter.receivedAt.toISOString(),
      content: letter.content,
      size: letter.size,
    });
  }
}

/** Body of GET /admin/dead-letters. */
export class DeadLetterListResponse {
  @ApiProperty({ type: [DeadLetterResponse], description: 'Newest first.' })
  items: DeadLetterResponse[];

  @ApiProperty({ description: 'Dead letters on all pages.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
