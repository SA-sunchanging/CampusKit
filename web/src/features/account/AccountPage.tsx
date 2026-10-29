import { useEffect, useState } from 'react';
import { getMe, type Profile } from '../../api/identity.ts';
import { Alert, Badge, PageHeader, Panel } from '../../ui/index.ts';
import EmailStep from './EmailStep.tsx';
import StudentStep from './StudentStep.tsx';
import { STUDENT_STATUS_TONE } from './studentStatus.ts';

// The caller's profile and, for a student, the two verification steps (role A).
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
    <section className="stack">
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
              <Badge tone={STUDENT_STATUS_TONE[profile.studentStatus]}>
                {profile.studentStatus}
              </Badge>
            </dd>
          </dl>
        </Panel>
      )}
      {profile?.role === 'student' && (
        <Panel title="Verification">
          <div className="stack">
            <p>
              Verify your email, then have an administrator check your student
              ID. You need both to publish a listing or book an item.
            </p>
            <EmailStep profile={profile} onChange={setProfile} />
            <StudentStep profile={profile} onChange={setProfile} />
          </div>
        </Panel>
      )}
    </section>
  );
}
