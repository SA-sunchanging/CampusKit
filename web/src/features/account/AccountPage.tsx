import { useEffect, useState } from 'react';
import { getMe, type Profile } from '../../api/identity.ts';

// The caller's profile (role A). Email verification comes later.
export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => active && setProfile(me))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <h2>Account</h2>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!profile && !error && <p>Loading...</p>}
      {profile && (
        <dl>
          <dt>Display name</dt>
          <dd>{profile.displayName}</dd>
          <dt>Email</dt>
          <dd>{profile.email}</dd>
          <dt>Role</dt>
          <dd>{profile.role}</dd>
          <dt>Email verified</dt>
          <dd>{profile.emailVerified ? 'Yes' : 'No'}</dd>
          <dt>Student status</dt>
          <dd>{profile.studentStatus}</dd>
        </dl>
      )}
    </section>
  );
}
