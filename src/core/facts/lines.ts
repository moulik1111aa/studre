/** One fact per line; blank lines ignored. */
export const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
