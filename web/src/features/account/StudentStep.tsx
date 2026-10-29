import { useState, type FormEvent } from 'react';
import { submitStudentId, type Profile } from '../../api/identity.ts';
import { Alert, Badge, Button, Field } from '../../ui/index.ts';
import { STUDENT_STATUS_TONE } from './studentStatus.ts';

// Step 2 of verification (role A): an administrator checks the submitted student ID.
export default function StudentStep({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const [studentId, setStudentId] = useState(profile.studentId ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = profile.studentStatus;
  const canSubmit =
    profile.emailVerified &&
    (status === 'UNSUBMITTED' || status === 'REJECTED');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onChange(await submitStudentId(studentId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <h3>
        2. Student status{' '}
        <Badge tone={STUDENT_STATUS_TONE[status]}>{status}</Badge>
      </h3>
      {!profile.emailVerified && <p>Verify your email first.</p>}
      {status === 'PENDING' && (
        <p>
          Student ID {profile.studentId} is waiting for an administrator to
          check it.
        </p>
      )}
      {status === 'VERIFIED' && <p>You are a verified Chula student.</p>}
      {status === 'REJECTED' && profile.studentRejectionReason && (
        <Alert tone="danger">
          Rejected: {profile.studentRejectionReason} Fix it and submit again.
        </Alert>
      )}
      {canSubmit && (
        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Student ID" hint="10 digits">
            <input
              name="studentId"
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              value={studentId}
              required
              onChange={(event) => setStudentId(event.target.value.trim())}
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="actions">
            <Button type="submit" disabled={pending || studentId.length !== 10}>
              {pending ? 'Submitting...' : 'Submit for review'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
