import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Body of POST /accounts/me/email-verification: a new code was issued. */
export class EmailCodeResponse {
  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional({
    example: '042917',
    description:
      'The code itself, only in demo mode, which sends no email; the web shows it on screen.',
  })
  demoCode?: string;

  static of(expiresAt: Date, demoCode?: string): EmailCodeResponse {
    const response = Object.assign(new EmailCodeResponse(), { expiresAt });
    if (demoCode !== undefined) {
      response.demoCode = demoCode;
    }
    return response;
  }
}
