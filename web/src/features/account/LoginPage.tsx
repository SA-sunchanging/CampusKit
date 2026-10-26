import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { login } from '../../api/identity.ts';
import { useAuth } from '../../auth/useAuth.ts';
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
    <section>
      <h2>Log in</h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={72}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending}>
          {pending ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p>
        No account yet?{' '}
        <Link to="/register" state={location.state}>
          Register
        </Link>
      </p>
    </section>
  );
}
