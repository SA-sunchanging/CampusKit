import type { NextFunction, Request, Response } from 'express';

/** Decodes until stable, so double-encoded segments such as %2569nternal are caught too. */
function fullyDecode(path: string): string {
  let current = path;
  for (let i = 0; i < 5; i++) {
    const next = decodeURIComponent(current);
    if (next === current) {
      return next;
    }
    current = next;
  }
  return current;
}

/**
 * True when any segment of the path is `internal`, ignoring case and percent-encoding.
 * Checking every segment also covers //internal, /./internal and /x/../internal.
 * Throws URIError when the path is not valid percent-encoding.
 */
export function isInternalPath(url: string): boolean {
  const path = fullyDecode(url.split('?')[0]).toLowerCase();
  return path.split(/[/\\]/).includes('internal');
}

/** Service-to-service endpoints under /internal are never reachable from outside. */
export function rejectInternalPath(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  let internal: boolean;
  try {
    internal = isInternalPath(req.url);
  } catch {
    res
      .status(400)
      .json({ error: { code: 'BAD_REQUEST', message: 'Malformed path' } });
    return;
  }
  if (internal) {
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return;
  }
  next();
}
