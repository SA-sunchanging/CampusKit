import { Module } from '@nestjs/common';
import { PasswordHasher } from './password-hasher.js';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

/** Swap the password algorithm by changing this factory. */
@Module({
  providers: [
    { provide: PasswordHasher, useFactory: () => new ScryptPasswordHasher() },
  ],
  exports: [PasswordHasher],
})
export class PasswordsModule {}
