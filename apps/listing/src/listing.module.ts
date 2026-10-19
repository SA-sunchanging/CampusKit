import { Module } from '@nestjs/common';
import { AuthModule, HealthModule, postgresOptions } from '@app/common';
import { ListingsModule } from './listings/listings.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { migrations } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRoot(postgresOptions('listing', migrations)),
    AuthModule,
    HealthModule.register('listing'),
    ListingsModule,
  ],
})
export class ListingModule {}
