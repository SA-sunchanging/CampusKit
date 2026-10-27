import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { PasswordHasher } from '../passwords/password-hasher.js';
import { Account } from './account.entity.js';
import type { RegisterDto } from './dto/register.dto.js';
import { checkEligibility } from '../eligibility/eligibility.js';
import { EligibilityResponse } from '../eligibility/eligibility.response.js';
import { normalizeEmail } from './email.js';
import { type Profile, toProfile } from './profile.js';

const UNIQUE_VIOLATION = '23505';
const EMAIL_TAKEN = 'Email is already registered';

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof QueryFailedError &&
    (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
  );
}

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account) private readonly accounts: Repository<Account>,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Creates a student account. Every self-registered account is a student; administrators are seeded. */
  async register(dto: RegisterDto): Promise<Profile> {
    const email = normalizeEmail(dto.email);
    if (await this.accounts.existsBy({ email })) {
      throw new ConflictException(EMAIL_TAKEN);
    }
    const account = this.accounts.create({
      email,
      passwordHash: await this.hasher.hash(dto.password),
      displayName: dto.displayName.trim(),
      role: 'student',
      studentStatus: 'UNSUBMITTED',
    });
    try {
      return toProfile(await this.accounts.save(account));
    } catch (err) {
      // Two concurrent registrations can both pass the check above; the unique index stops the second.
      if (isUniqueViolation(err)) {
        throw new ConflictException(EMAIL_TAKEN);
      }
      throw err;
    }
  }

  findByEmail(email: string): Promise<Account | null> {
    return this.accounts.findOneBy({ email: normalizeEmail(email) });
  }

  async getAccount(id: string): Promise<Account> {
    const account = await this.accounts.findOneBy({ id });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async getProfile(id: string): Promise<Profile> {
    return toProfile(await this.getAccount(id));
  }

  /** Whether the account may publish a listing or request a booking; asked by Listing and Booking. */
  async getEligibility(id: string): Promise<EligibilityResponse> {
    const account = await this.getAccount(id);
    return EligibilityResponse.of(account.id, checkEligibility(account));
  }
}
