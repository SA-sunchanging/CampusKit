import { useState, type FormEvent } from 'react';
import { setPayoutProfile, type PayoutProfile } from '../../api/identity.ts';
import { Alert, Button, Field, Panel } from '../../ui/index.ts';

export default function PayoutForm({
  payoutProfile,
  onSaved,
}: {
  payoutProfile: PayoutProfile | null;
  onSaved: (profile: PayoutProfile) => void;
}) {
  const [accountName, setAccountName] = useState(
    payoutProfile?.accountName ?? '',
  );
  const [promptPayId, setPromptPayId] = useState(
    payoutProfile?.promptPayId ?? '',
  );
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const profile = await setPayoutProfile({
        method: 'PROMPTPAY',
        accountName: accountName.trim(),
        promptPayId,
      });
      setAccountName(profile.accountName);
      setPromptPayId(profile.promptPayId);
      onSaved(profile);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Payout details">
      <div className="stack">
        <p>
          Add a payout destination before publishing a listing. You also need
          verified email and student status. These details are not required to
          book an item.
        </p>
        <p>
          Method: PromptPay. Demo mode records payments without transferring
          money.
        </p>
        <form
          className="form"
          aria-busy={pending}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <Field label="Account name" hint="name registered with PromptPay">
            <input
              name="accountName"
              autoComplete="name"
              required
              maxLength={100}
              pattern=".*\S.*"
              title="Enter an account name with at least one non-space character."
              value={accountName}
              disabled={pending}
              onChange={(event) => {
                setAccountName(event.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field
            label="PromptPay ID"
            hint="10-digit mobile number starting with 0, or 13-digit national ID"
          >
            <input
              name="promptPayId"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={13}
              pattern="0[0-9]{9}|[0-9]{13}"
              title="Enter a 10-digit mobile number starting with 0, or a 13-digit national ID, using digits only."
              value={promptPayId}
              disabled={pending}
              onChange={(event) => {
                setPromptPayId(event.target.value);
                setSaved(false);
              }}
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          {saved && <Alert tone="success">Payout details saved.</Alert>}
          <div className="actions">
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save payout details'}
            </Button>
          </div>
        </form>
      </div>
    </Panel>
  );
}
