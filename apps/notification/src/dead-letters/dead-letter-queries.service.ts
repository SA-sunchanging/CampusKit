import type { AuthUser } from '@app/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { DeadLetter, type DeadLetterRecord } from './dead-letter.schema.js';
import {
  DeadLetterListResponse,
  DeadLetterResponse,
} from './dead-letter.response.js';
import type { DeadLettersQuery } from './dto/dead-letters.query.js';

/** Read side of dead_letters: only administrators may see them. */
@Injectable()
export class DeadLetterQueriesService {
  constructor(
    @InjectModel(DeadLetter.name) private readonly letters: Model<DeadLetter>,
  ) {}

  /** A page of dead letters, newest first, and how many there are. Students get 403. */
  async list(
    caller: AuthUser,
    query: DeadLettersQuery,
  ): Promise<DeadLetterListResponse> {
    if (caller.role !== 'admin') {
      throw new ForbiddenException(
        'Only administrators can see dead-lettered events',
      );
    }
    const [rows, total] = await Promise.all([
      this.letters
        .find()
        .sort({ receivedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .lean<DeadLetterRecord[]>()
        .exec(),
      this.letters.countDocuments().exec(),
    ]);
    return Object.assign(new DeadLetterListResponse(), {
      items: rows.map((row) => DeadLetterResponse.of(row)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
