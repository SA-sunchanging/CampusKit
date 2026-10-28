import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { login } from '../../api/identity.ts';
import { useAuth } from '../../auth/useAuth.ts';
import { Alert, Button, Field, Panel } from '../../ui/index.ts';
import AuthIntro from './AuthIntro.tsx';
import { returnTo } from './returnTo.ts';

export default function LoginPage() {
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
      const { accessToken } = await login({
        email: String(form.get('email')),
        password: String(form.get('password')),
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
      <Panel title="Log in">
        <form className="form" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={72}
              required
            />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="actions">
            <Button type="submit" disabled={pending}>
              {pending ? 'Logging in...' : 'Log in'}
            </Button>
          </div>
        </form>
        <p>
          No account yet?{' '}
          <Link to="/register" state={location.state}>
            Register
          </Link>
        </p>
      </Panel>
    </div>
  );
}
