import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { Account } from '../accounts/account.entity.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { type Profile, toProfile } from '../accounts/profile.js';
import { EmailCodeResponse } from './email-code.response.js';
import { EmailVerification } from './email-verification.entity.js';
import {
  codeMatches,
  generateCode,
  hashCode,
  VerificationSettings,
} from './verification-code.js';

/** How long a code stays valid. */
export const CODE_TTL_MS = 15 * 60_000;
/** The shortest time between two codes for one account. */
export const REISSUE_INTERVAL_MS = 60_000;
/** Confirmations allowed per code; after that the code is void. */
export const MAX_ATTEMPTS = 5;

/** Proves the account holder controls the email address, with a one-time six-digit code. */
@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly accounts: AccountsService,
    @InjectRepository(EmailVerification)
    private readonly verifications: Repository<EmailVerification>,
    @InjectDataSource() private readonly db: DataSource,
    private readonly settings: VerificationSettings,
  ) {}

  /**
   * Issues a new code that replaces any earlier one. At most one code a minute, 409 once the
   * email is verified. The code is in the response only in demo mode.
   */
  async issue(accountId: string, now = new Date()): Promise<EmailCodeResponse> {
    await this.unverifiedAccount(accountId);
    const current = await this.verifications.findOneBy({ accountId });
    const waitMs = current
      ? current.createdAt.getTime() + REISSUE_INTERVAL_MS - now.getTime()
      : 0;
    if (waitMs > 0) {
      throw new HttpException(
        `Wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const code = generateCode();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
    await this.verifications.upsert(
      {
        accountId,
        codeHash: hashCode(this.settings.codeSecret, accountId, code),
        expiresAt,
        attempts: 0,
        createdAt: now,
      },
      ['accountId'],
    );
    return EmailCodeResponse.of(
      expiresAt,
      this.settings.demoMode ? code : undefined,
    );
  }

  /**
   * Checks the code and marks the email verified. Every try spends one attempt before the
   * comparison, in one conditional update, so parallel guesses cannot pass the limit. A missing,
   * expired, or used-up code answers 410; a wrong code answers 400.
   */
  async confirm(
    accountId: string,
    code: string,
    now = new Date(),
  ): Promise<Profile> {
    const account = await this.unverifiedAccount(accountId);
    const { affected } = await this.verifications.increment(
      {
        accountId,
        attempts: LessThan(MAX_ATTEMPTS),
        expiresAt: MoreThan(now),
      },
      'attempts',
      1,
    );
    const pending =
      affected === 1 ? await this.verifications.findOneBy({ accountId }) : null;
    if (!pending) {
      throw new GoneException('No valid code; ask for a new one');
    }
    if (
      !codeMatches(this.settings.codeSecret, accountId, code, pending.codeHash)
    ) {
      const left = MAX_ATTEMPTS - pending.attempts;
      throw new BadRequestException(
        left > 0
          ? `Wrong code; ${left} ${left === 1 ? 'try' : 'tries'} left`
          : 'Wrong code; ask for a new one',
      );
    }
    await this.db.transaction(async (tx) => {
      await tx.getRepository(Account).update(
        { id: accountId, emailVerifiedAt: IsNull() },
        {
          emailVerifiedAt: now,
        },
      );
      await tx.getRepository(EmailVerification).delete({ accountId });
    });
    account.emailVerifiedAt = now;
    return toProfile(account);
  }

  private async unverifiedAccount(accountId: string): Promise<Account> {
    const account = await this.accounts.getAccount(accountId);
    if (account.emailVerifiedAt !== null) {
      throw new ConflictException('Email is already verified');
    }
    return account;
  }
}
