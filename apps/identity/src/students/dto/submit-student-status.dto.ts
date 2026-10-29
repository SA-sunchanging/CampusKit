import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

/** Body of POST /accounts/me/student-status. */
export class SubmitStudentStatusDto {
  @ApiProperty({
    pattern: '^\\d{10}$',
    example: '6630012321',
    description: 'The 10-digit Chulalongkorn student ID.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/^\d{10}$/, { message: 'studentId must be 10 digits' })
  studentId: string;
}
