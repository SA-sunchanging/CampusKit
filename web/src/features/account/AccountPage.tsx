import { useEffect, useState } from 'react';
import { getMe, type Profile } from '../../api/identity.ts';
import { Alert, Badge, PageHeader, Panel, type Tone } from '../../ui/index.ts';

const STATUS_TONE: Record<Profile['studentStatus'], Tone> = {
  UNSUBMITTED: 'neutral',
  PENDING: 'warning',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

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
      <PageHeader title="Account" />
      {error && <Alert tone="danger">{error}</Alert>}
      {!profile && !error && <p>Loading...</p>}
      {profile && (
        <Panel>
          <dl>
            <dt>Display name</dt>
            <dd>{profile.displayName}</dd>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
            <dt>Role</dt>
            <dd>{profile.role}</dd>
            <dt>Email verified</dt>
            <dd>
              <Badge tone={profile.emailVerified ? 'success' : 'warning'}>
                {profile.emailVerified ? 'Yes' : 'No'}
              </Badge>
            </dd>
            <dt>Student status</dt>
            <dd>
              <Badge tone={STATUS_TONE[profile.studentStatus]}>
                {profile.studentStatus}
              </Badge>
            </dd>
          </dl>
        </Panel>
      )}
    </section>
  );
}
