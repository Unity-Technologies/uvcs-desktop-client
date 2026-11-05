import { onTestFinished } from 'vitest';
import { TrackerHttp, type FetchedResponse, type TrackerFetchInit, type TrackerRequestLog } from '../TrackerHttp';

/** An answer as a tracker gives it: its status, its JSON (or text), its headers. */
export interface TrackerAnswer {
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
  /** No answer comes: the network failed. */
  unreachable?: true;
  /** No answer comes until the request is canceled (its signal aborts): a tracker that takes too long. */
  hangs?: true;
}

/** A request the fake was asked, as it was sent. */
export interface FakeTrackerRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  /** The body read as JSON, or as a form. */
  json?: unknown;
  form?: Record<string, string>;
  redirect: string;
  credentials: string;
}

/** Answers keyed `METHOD url` (the whole address, query included). Several answers are given in turn, the last kept. */
export type TrackerAnswers = Record<string, TrackerAnswer | TrackerAnswer[] | ((request: FakeTrackerRequest) => TrackerAnswer)>;

export interface FakeTracker {
  /** A real `TrackerHttp` whose `fetch` the fake answers. */
  http: TrackerHttp;
  requests: FakeTrackerRequest[];
  /** `METHOD url` of each request, in order. */
  lines(): string[];
  logged: TrackerRequestLog[];
  /** Declares more answers. */
  answer(more: TrackerAnswers): void;
}

/**
 * A tracker that answers from JSON shaped exactly as each tracker returns it, records what it was asked, and fails the
 * test on any request it has no answer for, as `fakeCmClient` does for `cm`. No test reaches the network.
 */
export function fakeTrackerHttp(answers: TrackerAnswers = {}, { now = () => 0 }: { now?: () => number } = {}): FakeTracker {
  const declared: TrackerAnswers = { ...answers };
  const requests: FakeTrackerRequest[] = [];
  const logged: TrackerRequestLog[] = [];
  const unexpected: string[] = [];
  const served = new Map<string, number>();
  onTestFinished(() => {
    if (unexpected.length > 0) throw new Error(`The tracker was asked what no test declared:\n${unexpected.join('\n')}`);
  });

  const fetch = async (url: string, init: TrackerFetchInit): Promise<FetchedResponse> => {
    const request: FakeTrackerRequest = {
      method: init.method,
      url,
      headers: init.headers,
      ...(init.body !== undefined && { body: init.body }),
      ...readBody(init),
      redirect: init.redirect,
      credentials: init.credentials,
    };
    requests.push(request);
    const key = `${init.method} ${url}`;
    const found = declared[key];
    if (!found) {
      unexpected.push(key);
      throw new Error(`No answer for ${key}`);
    }
    const answer = typeof found === 'function' ? found(request) : Array.isArray(found) ? nextOf(found, key) : found;
    if (answer.unreachable) throw new Error(`${key}: the network failed`);
    if (answer.hangs) {
      await new Promise((_resolve, reject) => {
        const canceled = () => reject(new Error(`${key}: canceled`));
        if (init.signal.aborted) canceled();
        else init.signal.addEventListener('abort', canceled, { once: true });
      });
    }
    return responseOf(answer);
  };

  function nextOf(list: TrackerAnswer[], key: string): TrackerAnswer {
    const index = served.get(key) ?? 0;
    served.set(key, index + 1);
    return list[Math.min(index, list.length - 1)]!;
  }

  return {
    http: new TrackerHttp({ fetch, now, log: (entry) => logged.push(entry) }),
    requests,
    lines: () => requests.map(({ method, url }) => `${method} ${url}`),
    logged,
    answer: (more) => Object.assign(declared, more),
  };
}

function readBody(init: TrackerFetchInit): Pick<FakeTrackerRequest, 'json' | 'form'> {
  if (init.body === undefined) return {};
  if (init.headers['Content-Type'] === 'application/json') return { json: JSON.parse(init.body) };
  return { form: Object.fromEntries(new URLSearchParams(init.body)) };
}

function responseOf(answer: TrackerAnswer): FetchedResponse {
  const headers = new Map(Object.entries(answer.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));
  const text = answer.text ?? (answer.json === undefined ? '' : JSON.stringify(answer.json));
  return { status: answer.status ?? 200, headers: { get: (name) => headers.get(name.toLowerCase()) ?? null }, text: async () => text };
}
