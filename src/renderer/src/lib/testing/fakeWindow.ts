import type { UvcsBridge } from '@shared/bridge';
import type { UvcsEventName, UvcsEvents } from '@shared/events';
import type { InvokeRequest, InvokeResponse } from '@shared/ipc';

/** What a test sees of the fake `window.uvcs`: the calls made through `api`, and a way to send events from main. */
export interface FakeUvcs {
  /** Every `api.<area>.<method>(...)` call, in order. */
  readonly calls: InvokeRequest[];
  /** Answers `invoke` requests; by default every call succeeds with `undefined`. */
  answer: (request: InvokeRequest) => InvokeResponse | Promise<InvokeResponse>;
  /** Answers by method name (`'branches.list'`): a value succeeds with it, an `Error` fails with its message; others get `undefined`. */
  answerWith: (answers: Record<string, unknown>) => void;
  /** The methods called so far, in order. */
  methodsCalled: () => string[];
  /** Forgets the calls and goes back to answering every call with `undefined`: call it before each test. */
  reset: () => void;
  /** Sends an event as the main process would, to every listener registered with `window.uvcs.on`. */
  emit: <Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]) => void;
  /** How many listeners are registered for an event (a hook that forgot to unsubscribe leaves one behind). */
  listenerCount: (name: UvcsEventName) => number;
}

/**
 * Installs a minimal browser-like global `window` (with `window.uvcs`, `localStorage`, `matchMedia`) and `document`,
 * for renderer modules that read them as they load. Call it inside `vi.hoisted` before importing those modules:
 * `const uvcs = await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());`
 */
export function installFakeWindow(platform = 'darwin'): FakeUvcs {
  const listeners = new Map<UvcsEventName, Set<(payload: never) => void>>();
  const fake: FakeUvcs = {
    calls: [],
    answer: () => ({ ok: true, value: undefined }),
    answerWith: (answers) => {
      fake.answer = ({ method }) => {
        const answer = answers[method];
        return answer instanceof Error ? { ok: false, error: { message: answer.message } } : { ok: true, value: answer };
      };
    },
    methodsCalled: () => fake.calls.map((call) => call.method),
    reset: () => {
      fake.calls.length = 0;
      fake.answerWith({});
    },
    emit: (name, payload) => listeners.get(name)?.forEach((listener) => (listener as (payload: unknown) => void)(payload)),
    listenerCount: (name) => listeners.get(name)?.size ?? 0,
  };
  const uvcs: UvcsBridge = {
    invoke: async (request) => {
      fake.calls.push(request);
      return fake.answer(request);
    },
    on: (name, listener) => {
      const registered = listeners.get(name) ?? new Set();
      registered.add(listener as (payload: never) => void);
      listeners.set(name, registered);
      return () => registered.delete(listener as (payload: never) => void);
    },
    platform,
    pathForFile: () => '',
  };
  const storage = memoryStorage();
  const window = Object.assign(new EventTarget(), {
    uvcs,
    localStorage: storage,
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true, activeElement: null, body: null });
  Object.assign(globalThis, { window, localStorage: storage, document });
  return fake;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, String(value)),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
  };
}
