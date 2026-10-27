import { ApiProperty } from '@nestjs/swagger';

/** Body of POST /auth/login. */
export class AccessToken {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({ description: 'Lifetime in seconds.', example: 3600 })
  expiresIn: number;
}
