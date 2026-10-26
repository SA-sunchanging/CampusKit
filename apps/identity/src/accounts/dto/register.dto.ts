import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { normalizeEmail } from '../email.js';

export class RegisterDto {
  @ApiProperty({ example: 'somchai@student.chula.ac.th' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @Length(8, 72)
  password: string;

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'Somchai' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 50)
  displayName: string;
}
