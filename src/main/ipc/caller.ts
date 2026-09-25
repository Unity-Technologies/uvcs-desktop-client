import { AsyncLocalStorage } from 'node:async_hooks';
import type { WebContents } from 'electron';

const callers = new AsyncLocalStorage<WebContents>();

/** Runs an API call on behalf of a window, so what it causes (commands, progress) can be routed back to that window. */
export function runForCaller<T>(caller: WebContents, work: () => T): T {
  return callers.run(caller, work);
}

/** The window whose API call is running, followed across `await`s; undefined outside API calls. */
export function currentCaller(): WebContents | undefined {
  const caller = callers.getStore();
  return caller && !caller.isDestroyed() ? caller : undefined;
}

/** The id of the calling window's web contents, for API methods that only make sense for a window. */
export function callerId(): number {
  const caller = callers.getStore();
  if (!caller) throw new Error('This can only be asked from a window.');
  return caller.id;
}
