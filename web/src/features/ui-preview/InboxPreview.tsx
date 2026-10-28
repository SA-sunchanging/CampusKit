import {
  Badge,
  BellIcon,
  Button,
  Field,
  formatDate,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import { NOTICES } from './samples.ts';

// Inbox with an unread count and a review form (pattern for role E).
export default function InboxPreview() {
  const unread = NOTICES.filter((notice) => notice.unread).length;
  return (
    <section>
      <PageHeader
        title="Inbox and reviews"
        aside={<Badge tone="warning">{unread} unread</Badge>}
      />
      <Panel>
        {NOTICES.map((notice) => (
          <div className="row" key={notice.id}>
            <span className="row-icon">
              <BellIcon />
            </span>
            <div className="row-main">
              <h3>{notice.title}</h3>
              <p>{notice.body}</p>
              <small>{formatDate(notice.at)}</small>
            </div>
            {notice.unread && (
              <Button variant="ghost" size="small">
                Mark as read
              </Button>
            )}
          </div>
        ))}
      </Panel>
      <Panel title="Review the owner">
        <form className="form" onSubmit={(event) => event.preventDefault()}>
          <Field label="Rating">
            <select defaultValue="5">
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Poor</option>
              <option value="1">1 - Bad</option>
            </select>
          </Field>
          <Field label="Comment" hint="optional">
            <textarea maxLength={500} />
          </Field>
          <div className="actions">
            <Button type="submit">Submit review</Button>
          </div>
        </form>
      </Panel>
    </section>
  );
}
