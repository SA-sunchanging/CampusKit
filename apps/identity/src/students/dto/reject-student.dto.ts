import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Body of POST /admin/students/:id/reject. The student reads the reason on the account page. */
export class RejectStudentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: 300,
    example: 'The student ID does not match the registry.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 300)
  reason: string;
}
