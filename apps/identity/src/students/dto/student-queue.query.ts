import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  STUDENT_STATUSES,
  type StudentStatus,
} from '../../accounts/account.entity.js';

export const MAX_PAGE_SIZE = 50;

/** Query of GET /admin/students. Students waiting for review by default. */
export class StudentQueueQuery {
  @ApiPropertyOptional({ enum: STUDENT_STATUSES, default: 'PENDING' })
  @IsOptional()
  @IsIn(STUDENT_STATUSES)
  status: StudentStatus = 'PENDING';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = 20;
}
