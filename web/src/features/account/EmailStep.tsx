import { useState, type FormEvent } from 'react';
import {
  confirmEmail,
  requestEmailCode,
  type EmailCode,
  type Profile,
} from '../../api/identity.ts';
import { Alert, Badge, Button, Field } from '../../ui/index.ts';

// Step 1 of verification (role A): prove control of the email with a six-digit code.
// The demo sends no email, so the service returns the code and this step shows it.
export default function EmailStep({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (profile: Profile) => void;
}) {
  const [issued, setIssued] = useState<EmailCode | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await call();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const sendCode = () =>
    void run(async () => {
      setIssued(await requestEmailCode());
      setCode('');
    });

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => onChange(await confirmEmail(code)));
  }

  if (profile.emailVerified) {
    return (
      <div className="stack">
        <h3>
          1. Email <Badge tone="success">VERIFIED</Badge>
        </h3>
        <p>{profile.email} is verified.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <h3>1. Email</h3>
      <p>We send a six-digit code to {profile.email}.</p>
      {issued?.demoCode && (
        <p>
          Demo mode, no email is sent. Your code:{' '}
          <span className="code">{issued.demoCode}</span>
        </p>
      )}
      {issued && (
        <form className="form" onSubmit={handleConfirm}>
          <Field label="Code" hint="valid for 15 minutes, 5 tries">
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              required
              onChange={(event) => setCode(event.target.value.trim())}
            />
          </Field>
          <div className="actions">
            <Button type="submit" disabled={pending || code.length !== 6}>
              {pending ? 'Checking...' : 'Verify email'}
            </Button>
          </div>
        </form>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="actions">
        <Button
          variant={issued ? 'ghost' : undefined}
          disabled={pending}
          onClick={sendCode}
        >
          {issued ? 'Send a new code' : 'Send code'}
        </Button>
      </div>
    </div>
  );
}
