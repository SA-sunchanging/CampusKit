import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Only shape checks here: a wrong email or password must fail with the same 401, not a 400. */
export class LoginDto {
  @ApiProperty({ example: 'somchai@student.chula.ac.th' })
  @IsString()
  @MaxLength(254)
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(72)
  password: string;
}
