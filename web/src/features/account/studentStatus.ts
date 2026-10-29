import type { StudentStatus } from '../../api/identity.ts';
import type { Tone } from '../../ui/index.ts';

export const STUDENT_STATUS_TONE: Record<StudentStatus, Tone> = {
  UNSUBMITTED: 'neutral',
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};
