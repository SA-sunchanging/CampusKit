import { Panel } from '../../ui/index.ts';

const TEXT = {
  pickup: {
    title: 'Your pickup code',
    use: 'Show this code to the renter when you hand over the item. They enter it on their rental page to confirm the pickup.',
  },
  return: {
    title: 'Your return code',
    use: 'Show this code to the owner when you bring the item back. They enter it on their rental page to confirm the return.',
  },
};

// The viewer's own code (role D): the owner's pickup code or the renter's return code.
export default function CodePanel({
  kind,
  code,
}: {
  kind: 'pickup' | 'return';
  code: string;
}) {
  const text = TEXT[kind];
  return (
    <Panel title={text.title}>
      <div className="stack">
        <p>{text.use}</p>
        {code ? (
          <span className="code rental-code">{code}</span>
        ) : (
          <p>The code is not available. Reload the page to try again.</p>
        )}
        <p className="rental-note">
          After five wrong attempts the code is replaced. Reload this page to
          see the new one.
        </p>
      </div>
    </Panel>
  );
}
