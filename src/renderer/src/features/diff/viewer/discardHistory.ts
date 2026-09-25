/** A discard written to a workspace file: its text before and after. */
export interface Discard {
  before: string;
  after: string;
}

/**
 * The discards made to each file in this session, newest last, so they can be undone one after another. Kept per
 * workspace file, whatever diff they were made in.
 */
const history = new Map<string, Discard[]>();

const keyOf = (workspacePath: string, path: string): string => `${workspacePath}\0${path}`;

export function recordDiscard(workspacePath: string, path: string, discard: Discard): void {
  const key = keyOf(workspacePath, path);
  history.set(key, [...(history.get(key) ?? []), discard]);
}

export function lastDiscard(workspacePath: string, path: string): Discard | undefined {
  return history.get(keyOf(workspacePath, path))?.at(-1);
}

export function forgetDiscard(workspacePath: string, path: string, discard: Discard): void {
  const key = keyOf(workspacePath, path);
  const left = (history.get(key) ?? []).filter((entry) => entry !== discard);
  if (left.length > 0) history.set(key, left);
  else history.delete(key);
}
