import { type AuthUser, CurrentUser, JwtAuthGuard } from '@app/common';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Profile } from '../accounts/profile.js';
import { SubmitStudentStatusDto } from './dto/submit-student-status.dto.js';
import { StudentStatusService } from './student-status.service.js';

/** The caller's student status, at /api/identity/accounts/me/student-status. */
@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts/me/student-status')
export class StudentStatusController {
  constructor(private readonly students: StudentStatusService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: Profile })
  @ApiConflictResponse({
    description:
      'The email is not verified yet, or the status is PENDING or VERIFIED.',
  })
  submit(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitStudentStatusDto,
  ): Promise<Profile> {
    return this.students.submit(user.sub, dto.studentId);
  }
}
