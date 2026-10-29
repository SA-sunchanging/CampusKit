import { ApiProperty } from '@nestjs/swagger';
import {
  type Account,
  STUDENT_STATUSES,
  type StudentStatus,
} from '../accounts/account.entity.js';

/** An account as the administrator's student review queue shows it. */
export class StudentReviewItemResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'somchai@student.chula.ac.th' })
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ type: String, nullable: true, example: '6630012321' })
  studentId: string | null;

  @ApiProperty({ enum: STUDENT_STATUSES })
  studentStatus: StudentStatus;

  @ApiProperty({ type: Date, nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiProperty({ type: Date, nullable: true })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  static of(account: Account): StudentReviewItemResponse {
    return Object.assign(new StudentReviewItemResponse(), {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      studentId: account.studentId,
      studentStatus: account.studentStatus,
      submittedAt: account.studentSubmittedAt,
      rejectionReason: account.studentRejectionReason,
      reviewedAt: account.studentReviewedAt,
      createdAt: account.createdAt,
    });
  }
}

/** Body of GET /admin/students. */
export class StudentQueueResponse {
  @ApiProperty({ type: [StudentReviewItemResponse] })
  items: StudentReviewItemResponse[];

  @ApiProperty({ description: 'Matching accounts on all pages.' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
