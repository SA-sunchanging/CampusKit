import { useState } from 'react';
import type { Rental } from '../../api/rental.ts';
import { Panel } from '../../ui/index.ts';
import CodeEntryForm from './CodeEntryForm.tsx';
import CodePanel from './CodePanel.tsx';
import RetrySettlement from './RetrySettlement.tsx';
import { nextAction, nextStepNote } from './status.ts';

// What the viewer does next on the rental page (role D). Rental checks every step again.
export default function NextStep({
  rental,
  viewerId,
  onChange,
}: {
  rental: Rental;
  viewerId: string;
  onChange: (rental: Rental) => void;
}) {
  // Read the clock once per page view: the pickup window is checked again on the server.
  const [now] = useState(() => new Date());
  switch (nextAction(rental, viewerId, now)) {
    case 'show-pickup-code':
      return <CodePanel kind="pickup" code={rental.pickupCode} />;
    case 'show-return-code':
      return <CodePanel kind="return" code={rental.returnCode} />;
    case 'enter-pickup-code':
      return (
        <CodeEntryForm kind="pickup" rentalId={rental.id} onDone={onChange} />
      );
    case 'enter-return-code':
      return (
        <CodeEntryForm kind="return" rentalId={rental.id} onDone={onChange} />
      );
    case 'retry-settlement':
      return <RetrySettlement rental={rental} onDone={onChange} />;
    default: {
      const note = nextStepNote(rental, viewerId, now);
      return note ? (
        <Panel title="Next step">
          <p>{note}</p>
        </Panel>
      ) : null;
    }
  }
}
