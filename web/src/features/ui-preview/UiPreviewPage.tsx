import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Hero,
  PageHeader,
  Panel,
} from '../../ui/index.ts';
import FlowPreview from './FlowPreview.tsx';
import InboxPreview from './InboxPreview.tsx';
import ListingPreview from './ListingPreview.tsx';

// Shared components and sample screens (role A). Not in the nav; open
// /ui-preview. Every value here is sample data, not from the services.
export default function UiPreviewPage() {
  return (
    <>
      <Alert tone="success">
        UI preview with sample data. Build pages from web/src/ui; copy the
        patterns below.
      </Alert>
      <section>
        <PageHeader title="Components" aside="web/src/ui" />
        <Hero
          eyebrow="FOR CHULA STUDENTS"
          title="Borrow a little, do a lot."
          tags={['Verified students', 'Deposit protected', 'Campus pickup']}
        >
          <p>Hero for the home page.</p>
        </Hero>
        <Panel title="Buttons, badges, alerts">
          <div className="stack">
            <div className="actions">
              <Button>Primary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button size="small">Small</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="actions">
              <Badge>NEUTRAL</Badge>
              <Badge tone="success">SUCCESS</Badge>
              <Badge tone="warning">WARNING</Badge>
              <Badge tone="danger">DANGER</Badge>
            </div>
            <Alert tone="success">Saved.</Alert>
            <Alert tone="danger">Something went wrong.</Alert>
            <Field label="Field" hint="with a hint">
              <input placeholder="Type here" />
            </Field>
            <EmptyState title="Nothing here yet">
              Shown when a list is empty.
            </EmptyState>
          </div>
        </Panel>
      </section>
      <ListingPreview />
      <FlowPreview />
      <InboxPreview />
    </>
  );
}
