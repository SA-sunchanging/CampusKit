import type { AuthUser } from '@app/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { InboxEntry, type InboxEntryRecord } from './inbox-entry.schema.js';
import {
  InboxEntryResponse,
  InboxListResponse,
  UnreadCountResponse,
} from './inbox.response.js';

/** GET /inbox returns at most this many entries. */
export const LIST_LIMIT = 50;

/** Matches entries without readAt (missing or null). */
const UNREAD = { readAt: null };

/** IDs are stored in lower case (see inbox-entry.schema.ts). */
const recipientOf = (caller: AuthUser): string => caller.sub.toLowerCase();

/** The REST side of the inbox: a caller sees and marks only their own entries. */
@Injectable()
export class InboxQueriesService {
  constructor(
    @InjectModel(InboxEntry.name) private readonly entries: Model<InboxEntry>,
  ) {}

  /** The caller's newest LIST_LIMIT entries, and how many of all their entries are unread. */
  async list(caller: AuthUser): Promise<InboxListResponse> {
    const recipient = recipientOf(caller);
    const [entries, unread] = await Promise.all([
      this.entries
        .find({ recipient })
        .sort({ occurredAt: -1, _id: -1 })
        .limit(LIST_LIMIT)
        .lean<InboxEntryRecord[]>()
        .exec(),
      this.countUnread(recipient),
    ]);
    return InboxListResponse.of(entries, unread);
  }

  async unreadCount(caller: AuthUser): Promise<UnreadCountResponse> {
    return UnreadCountResponse.of(await this.countUnread(recipientOf(caller)));
  }

  /**
   * Marks one of the caller's entries read. Idempotent: an entry already read keeps its first
   * readAt. Another user's entry answers 404, the same as a missing one.
   */
  async markRead(
    caller: AuthUser,
    eventId: string,
  ): Promise<InboxEntryResponse> {
    const filter = {
      eventId: eventId.toLowerCase(),
      recipient: recipientOf(caller),
    };
    const updated = await this.entries
      .findOneAndUpdate(
        { ...filter, ...UNREAD },
        { $set: { readAt: new Date() } },
        { returnDocument: 'after' },
      )
      .lean<InboxEntryRecord>()
      .exec();
    const entry =
      updated ??
      (await this.entries.findOne(filter).lean<InboxEntryRecord>().exec());
    if (!entry) {
      throw new NotFoundException('Notice not found');
    }
    return InboxEntryResponse.of(entry);
  }

  /** Marks every unread entry of the caller read; nothing is unread afterwards. */
  async markAllRead(caller: AuthUser): Promise<UnreadCountResponse> {
    await this.entries
      .updateMany(
        { recipient: recipientOf(caller), ...UNREAD },
        { $set: { readAt: new Date() } },
      )
      .exec();
    return UnreadCountResponse.of(0);
  }

  private countUnread(recipient: string): Promise<number> {
    return this.entries.countDocuments({ recipient, ...UNREAD }).exec();
  }
}
