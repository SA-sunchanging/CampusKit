/** Emails are compared and stored trimmed and lowercased, so `A@x.com ` and `a@x.com` are one account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
