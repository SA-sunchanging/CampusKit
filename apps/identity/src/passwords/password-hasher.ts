/**
 * Hashes and checks passwords. Inject this class, never an implementation, so the algorithm can be swapped.
 * Implementations prefix each hash with their algorithm name (for example `scrypt$...`) so stored hashes
 * stay readable after a switch.
 */
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;

  /** Returns false for a wrong password or a hash this implementation cannot read; never throws for those. */
  abstract verify(password: string, stored: string): Promise<boolean>;
}
