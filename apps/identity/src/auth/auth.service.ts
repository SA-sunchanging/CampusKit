import type { AuthUser } from '@app/common';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountsService } from '../accounts/accounts.service.js';
import { PasswordHasher } from '../passwords/password-hasher.js';
import { AccessToken } from './access-token.js';
import type { LoginDto } from './dto/login.dto.js';

/** Token lifetime in seconds, from JWT_EXPIRES_IN. */
export function tokenLifetime(env = process.env.JWT_EXPIRES_IN): number {
  const seconds = Number(env);
  return env && Number.isInteger(seconds) && seconds > 0 ? seconds : 3600;
}

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly expiresIn = tokenLifetime();
  private dummyHash?: Promise<string>;

  constructor(
    private readonly accounts: AccountsService,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  /** Unknown email and wrong password fail the same way, so the endpoint does not reveal who has an account. */
  async login(dto: LoginDto): Promise<AccessToken> {
    const account = await this.accounts.findByEmail(dto.email);
    // Hash even for an unknown email so both failures take about the same time.
    const stored = account?.passwordHash ?? (await this.getDummyHash());
    const valid = await this.hasher.verify(dto.password, stored);
    if (!account || !valid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (account.suspendedAt) {
      throw new ForbiddenException('Account is suspended');
    }
    const claims: AuthUser = { sub: account.id, role: account.role };
    return Object.assign(new AccessToken(), {
      accessToken: await this.jwt.signAsync(claims, {
        expiresIn: this.expiresIn,
      }),
      tokenType: 'Bearer' as const,
      expiresIn: this.expiresIn,
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('not-a-real-password');
    return this.dummyHash;
  }
}
