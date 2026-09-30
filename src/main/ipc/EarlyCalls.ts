import type { ApiMethod } from './apiMethods';

/**
 * How long an early answer waits for the page's call: a page asks within a second of its window opening, and an
 * answer older than this would be a stale read (a window closed at once, a page that asked for something else).
 */
export const EARLY_ANSWER_MS = 5000;

type Schedule = (drop: () => void, ms: number) => void;

const unrefTimeout: Schedule = (drop, ms) => void setTimeout(drop, ms).unref();

/**
 * API calls the main process makes before a window's page does (`readFirstScreen`), so their `cm` commands run while
 * the window is created and its page loads instead of after. The page's first call with the same method and arguments
 * takes the answer, in flight or done, instead of running again (`registerApi`); an answer nobody takes goes after
 * `EARLY_ANSWER_MS`.
 */
export class EarlyCalls {
  private readonly answers = new Map<string, Promise<unknown>>();

  constructor(
    private readonly methods: Map<string, ApiMethod>,
    private readonly schedule: Schedule = unrefTimeout,
  ) {}

  /** Calls `method` (`<area>.<method>`) now, for a page to take its answer. */
  start(method: string, args: unknown[]): void {
    const call = this.methods.get(method);
    if (!call) throw new Error(`Unknown API method ${method}`);
    const key = callKey(method, args);
    const answer = (async () => call(...args))();
    // A failure is the page's to see when it asks, as if it had made the call; until then it is no unhandled one.
    answer.catch(() => {});
    this.answers.set(key, answer);
    this.schedule(() => this.answers.get(key) === answer && this.answers.delete(key), EARLY_ANSWER_MS);
  }

  /** The answer of the early call with this method and arguments, once; undefined when there is none. */
  take(method: string, args: unknown[]): Promise<unknown> | undefined {
    const key = callKey(method, args);
    const answer = this.answers.get(key);
    this.answers.delete(key);
    return answer;
  }
}

/** A call as one string: equal arguments give equal keys, whatever order their objects' keys come in. */
export function callKey(method: string, args: unknown[]): string {
  return JSON.stringify([method, args], (_key, value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value,
  );
}
