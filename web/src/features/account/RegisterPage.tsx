import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { registerAndLogin } from '../../api/identity.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { Alert, Button, Field, Panel } from '../../ui/index.ts';
import AuthIntro from './AuthIntro.tsx';
import { returnTo } from './returnTo.ts';

// The length limits mirror the identity DTO for quick feedback; the server stays authoritative.
export default function RegisterPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Already logged in, or just logged in: go where login would have gone.
  if (auth.user) return <Navigate to={returnTo(location.state)} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { accessToken } = await registerAndLogin({
        email: String(form.get('email')),
        password: String(form.get('password')),
        displayName: String(form.get('displayName')),
      });
      auth.login(accessToken);
      void navigate(returnTo(location.state), { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="split">
      <AuthIntro />
      <Panel title="Register">
        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Display name">
            <input
              name="displayName"
              autoComplete="nickname"
              maxLength={50}
              required
            />
          </Field>
          <Field label="Password" hint="8 to 72 characters">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              required
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="actions">
            <Button type="submit" disabled={pending}>
              {pending ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </form>
        <p>
          Already registered?{' '}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </Panel>
    </div>
  );
}
