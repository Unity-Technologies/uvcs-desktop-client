/// <reference types="node" />
import { afterEach, beforeEach, expect } from 'vitest';
import type { UvcsBridge } from '@shared/bridge';
import type { UvcsEventName, UvcsEvents } from '@shared/events';
import type { FailedCommand, InvokeRequest, InvokeResponse } from '@shared/ipc';
import { memoryStorage } from './memoryStorage';

/**
 * A window like the preload's for renderer modules under test, installed as this module loads: import it before
 * anything that reads `window` or `document` at load (`lib/platform`, `app/queryClient`, the menus). The platform is
 * macOS; a test of another one calls `setPlatform` in `vi.hoisted`, before its modules load.
 *
 * `fakeApi` answers `api.<area>.<method>(...)` calls the test declares (`fakeApi.answer`), records every call, and
 * fails the test on any call it wasn't told to expect. Each test starts with no answers, calls or storage; listeners stay,
 * as modules that subscribe as they load (`commandLogStore`) registered them.
 */

type Handler = (...args: never[]) => unknown;
type Listener = (payload: never) => void;

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
const listeners = new Map<string, Set<Listener>>();
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

function on(name: string, listener: Listener): () => void {
  const named = listeners.get(name) ?? new Set();
  listeners.set(name, named);
  named.add(listener);
  return () => named.delete(listener);
}

const storage = memoryStorage();
const uvcs: UvcsBridge = { platform: 'darwin', invoke, on: on as UvcsBridge['on'], pathForFile: () => '' };
const fakeWindow = Object.assign(new EventTarget(), {
  uvcs,
  localStorage: storage,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
});
const fakeDocument = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true, activeElement: null, body: null });
Object.assign(globalThis, { window: fakeWindow, localStorage: storage, document: fakeDocument });

/** The platform `window.uvcs.platform` reports: call it in `vi.hoisted`, before the modules that read it load. */
export function setPlatform(platform: string): void {
  Object.assign(uvcs, { platform });
}

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
  emit<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
    for (const listener of listeners.get(name) ?? []) (listener as (payload: unknown) => void)(payload);
  },
  /** How many listeners are registered for an event (a hook that forgot to unsubscribe leaves one behind). */
  listenerCount(name: UvcsEventName): number {
    return listeners.get(name)?.size ?? 0;
  },
};

beforeEach(() => {
  handlers.clear();
  calls.length = 0;
  unexpected.length = 0;
  storage.clear();
});

afterEach(() => {
  expect(unexpected, 'api calls no test answered').toEqual([]);
});
