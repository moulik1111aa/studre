// Screens that change with MN × (the look, the map, the MN × page) listen here. Google Play
// answers in the Play build (ui/membership.ts); on the app shared by link, the lock check and
// the owner's answer to a request do (ui/access.ts, ui/cloud.ts).

const listeners = new Set<() => void>();

/** Run `fn` whenever MN × turns on or off (a screen re-draws). Returns a function that stops it. */
export function onPlusChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** MN × changed (or a purchase or request went through): every listener re-draws. */
export function plusChanged(): void {
  for (const fn of listeners) fn();
}
