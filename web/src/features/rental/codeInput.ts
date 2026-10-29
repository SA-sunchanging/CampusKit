// The six-digit pickup and return codes (role D). Rental checks the code on the server.
export const CODE_LENGTH = 6;

/** Keeps only the digits of what was typed or pasted, at most six. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** Exactly six digits. */
export function isCompleteCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
