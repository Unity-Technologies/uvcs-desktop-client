/// <reference types="node" />
import { afterEach, beforeEach, expect } from 'vitest';
import type { FailedCommand, InvokeRequest, InvokeResponse } from '@shared/ipc';

/**
 * A window like the preload's for renderer modules under test (operations, stores), installed as this module loads:
 * import it before anything that reads `window` at load (`lib/platform`, `app/queryClient`).
 *
 * `fakeApi` answers `api.<area>.<method>(...)` calls the test declares (`fakeApi.answer`), records every call, and
 * fails the test on any call it wasn't told to expect. Each test starts with no answers, calls or listeners.
 */

type Handler = (...args: never[]) => unknown;
type EventListener = (payload: never) => void;

export interface ApiCall {
  method: string;
  args: unknown[];
}

/** An error as the main process reports a failed `cm` command (`ApiError` with its `command`). */
export class FakeCommandFailure extends Error {
  constructor(readonly command: FailedCommand) {
    super(command.output);
  }
}

/** A failed `cm` command printing `output`, for `fakeApi.answer(method, () => { throw commandFailure(...) })`. */
export function commandFailure(output: string, commandLine = 'cm'): FakeCommandFailure {
  return new FakeCommandFailure({ commandLine, exitCode: 1, output, logEntryId: 1 });
}

const handlers = new Map<string, Handler>();
const listeners = new Map<string, Set<EventListener>>();
const calls: ApiCall[] = [];
const unexpected: string[] = [];

async function invoke({ method, args }: InvokeRequest): Promise<InvokeResponse> {
  calls.push({ method, args });
  const handler = handlers.get(method);
  if (!handler) {
    unexpected.push(method);
    return { ok: false, error: { message: `Unexpected call to ${method}` } };
  }
  try {
    return { ok: true, value: await (handler as (...args: unknown[]) => unknown)(...args) };
  } catch (error) {
    const command = error instanceof FakeCommandFailure ? error.command : undefined;
    return { ok: false, error: { message: error instanceof Error ? error.message : String(error), command } };
  }
}

function on(name: string, listener: EventListener): () => void {
  const named = listeners.get(name) ?? new Set();
  listeners.set(name, named);
  named.add(listener);
  return () => named.delete(listener);
}

const stored = new Map<string, string>();
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
};
const uvcs = { platform: 'darwin', invoke, on };
const fakeWindow = Object.assign(new EventTarget(), { uvcs, localStorage: storage, matchMedia: () => ({ matches: false, addEventListener: () => {} }) });
const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true });
Object.assign(globalThis, { window: fakeWindow, localStorage: storage, document: fakeDocument });

export const fakeApi = {
  /** Answers every call to `method` (`'area.method'`) with what `handler` returns; a throw fails the call. */
  answer<T extends Handler>(method: string, handler: T): void {
    handlers.set(method, handler);
  },
  /** Every call so far, in order. */
  calls(): ApiCall[] {
    return [...calls];
  },
  /** The methods called so far, in order. */
  methods(): string[] {
    return calls.map((call) => call.method);
  },
  /** The arguments of each call to `method`. */
  argsOf(method: string): unknown[][] {
    return calls.filter((call) => call.method === method).map((call) => call.args);
  },
  /** Sends an event from the main process, as `window.uvcs.on(name)` listeners get it. */
  emit(name: string, payload: unknown): void {
    for (const listener of listeners.get(name) ?? []) (listener as (payload: unknown) => void)(payload);
  },
};

beforeEach(() => {
  handlers.clear();
  listeners.clear();
  calls.length = 0;
  unexpected.length = 0;
  stored.clear();
});

afterEach(() => {
  expect(unexpected, 'api calls no test answered').toEqual([]);
});
