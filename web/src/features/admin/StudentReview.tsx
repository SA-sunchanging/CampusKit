import { useEffect, useState } from 'react';
import { getStudentQueue, type StudentQueue } from '../../api/identity.ts';
import { Alert, Button, EmptyState, ShieldIcon } from '../../ui/index.ts';
import StudentCard from './StudentCard.tsx';

interface Loaded {
  /** The page this answer is for. */
  page: number;
  queue?: StudentQueue;
  error?: string;
}

// Students who submitted a student ID, oldest first (role A). Admin only.
export default function StudentReview() {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    getStudentQueue('PENDING', page)
      .then((queue) => active && setLoaded({ page, queue }))
      .catch((err: Error) => active && setLoaded({ page, error: err.message }));
    return () => {
      active = false;
    };
  }, [page, reload]);

  function handleDone(message: string) {
    setNotice(message);
    setReload((count) => count + 1);
  }

  const current = loaded?.page === page ? loaded : null;
  if (!current) return <p>Loading students waiting for review...</p>;
  if (!current.queue) return <Alert tone="danger">{current.error}</Alert>;
  const { items, total, pageSize } = current.queue;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="stack">
      {notice && <Alert tone="success">{notice}</Alert>}
      {items.length === 0 ? (
        <EmptyState
          title="No student waiting for review"
          icon={<ShieldIcon size={32} />}
        >
          Students appear here after they verify their email and submit their
          student ID.
        </EmptyState>
      ) : (
        <>
          <p className="admin-count">
            {total === 1 ? '1 student' : `${total} students`} waiting, oldest
            first.
          </p>
          {items.map((item) => (
            <StudentCard key={item.id} item={item} onDone={handleDone} />
          ))}
        </>
      )}
      {pages > 1 && (
        <nav className="admin-pager" aria-label="Student review pages">
          <Button
            variant="ghost"
            size="small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            variant="ghost"
            size="small"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
