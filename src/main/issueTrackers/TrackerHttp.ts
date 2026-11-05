import { TrackerError } from './TrackerError';
import { isRateLimited, restUntil, TrackerCooldown, type HeaderOf } from './rateLimits';

/** A request's options as the session's `fetch` takes them: no cookies, no redirect followed. */
export interface TrackerFetchInit {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  redirect: 'manual';
  credentials: 'omit';
  signal: AbortSignal;
}

/** What the app reads of an answer. */
export interface FetchedResponse {
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

/** The session's `fetch` (`session.fromPartition('issue-trackers').fetch`), passed in so tests answer it. */
export type TrackerFetch = (url: string, init: TrackerFetchInit) => Promise<FetchedResponse>;

export interface TrackerRequest {
  method: 'GET' | 'POST';
  url: string;
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as a form (OAuth's endpoints). */
  form?: Record<string, string>;
}

export interface TrackerResponse {
  status: number;
  header: HeaderOf;
  /** The answer read as JSON; undefined when it isn't (an HTML page). */
  body: unknown;
}

/** One request, as the command log shows it: method, host and path, never the query, a header or a body. */
export interface TrackerRequestLog {
  method: string;
  host: string;
  path: string;
  startedAt: number;
  durationMs: number;
  /** The answer's status; none when there was no answer. */
  httpStatus?: number;
  /** Why it failed, in the `TrackerError`'s words. */
  failure?: string;
}

/** The one way to a tracker for one connection (or none: a sign-in's first requests). */
export interface ConnectionHttp {
  send(request: TrackerRequest): Promise<TrackerResponse>;
  /**
   * The tracker said in an answer's body to leave it alone (GitHub's GraphQL `RATE_LIMITED`): its origin rests until
   * the time the answer's headers give (`restUntil`), which this returns.
   */
  restOrigin(url: string, header: HeaderOf): number;
}

interface TrackerHttpOptions {
  fetch: TrackerFetch;
  now?: () => number;
  log?: (entry: TrackerRequestLog) => void;
  timeoutMs?: number;
}

/** A request with no answer by then fails as `unreachable`. */
export const TRACKER_REQUEST_TIMEOUT_MS = 20_000;

/**
 * The one way to a tracker (docs/features/issue-trackers.md, "The HTTP client"), as `CmClient` is to `cm`. A credential
 * goes only to its connection's origins, a redirect is never followed, a rate limit rests the origin, and every
 * failure is a `TrackerError`.
 */
export class TrackerHttp {
  private readonly now: () => number;
  private readonly cooldown: TrackerCooldown;

  constructor(private readonly options: TrackerHttpOptions) {
    this.now = options.now ?? Date.now;
    this.cooldown = new TrackerCooldown(this.now);
  }

  /**
   * Requests to `origins` only, with `authorization` (none for a sign-in's anonymous steps); `onRefused` hears a 401,
   * which sets the connection's credential `refused`.
   */
  bound(origins: readonly string[], authorization: string | null, onRefused?: () => void): ConnectionHttp {
    const allowed = new Set(origins.map((origin) => origin.toLowerCase()));
    return {
      send: (request) => this.send(request, allowed, authorization, onRefused),
      restOrigin: (url, header) => {
        const until = restUntil(header, this.now());
        this.cooldown.rest(new URL(url).origin, until);
        return until;
      },
    };
  }

  /** Until when `origin` rests from a rate limit, or null. */
  restingUntil(origin: string): number | null {
    return this.cooldown.restingUntil(origin);
  }

  private async send(request: TrackerRequest, allowed: ReadonlySet<string>, authorization: string | null, onRefused?: () => void): Promise<TrackerResponse> {
    const url = new URL(request.url);
    const where = `${url.host}${url.pathname}`;
    if (url.protocol !== 'https:' || !allowed.has(url.origin.toLowerCase())) throw new TrackerError('unexpected', `Not sent to ${where}: it isn't this tracker's`);
    const resting = this.cooldown.restingUntil(url.origin);
    if (resting !== null) throw new TrackerError('rateLimited', `${url.host} asked to wait`, resting);

    const startedAt = this.now();
    const log = (httpStatus: number | undefined, failure?: string): void =>
      this.options.log?.({ method: request.method, host: url.host, path: url.pathname, startedAt, durationMs: this.now() - startedAt, ...(httpStatus !== undefined && { httpStatus }), ...(failure && { failure }) });

    let response: FetchedResponse;
    try {
      response = await this.options.fetch(url.href, {
        method: request.method,
        headers: headersOf(request, authorization),
        ...(bodyOf(request) !== undefined && { body: bodyOf(request) }),
        redirect: 'manual',
        credentials: 'omit',
        signal: AbortSignal.timeout(this.options.timeoutMs ?? TRACKER_REQUEST_TIMEOUT_MS),
      });
    } catch {
      const failure = `${url.host} couldn't be reached`;
      log(undefined, failure);
      throw new TrackerError('unreachable', failure);
    }

    const header: HeaderOf = (name) => response.headers.get(name);
    const failure = this.failureOf(response.status, header, url, where);
    if (failure) {
      log(response.status, failure.message);
      if (failure.reason === 'signInRefused') onRefused?.();
      if (failure.reason === 'rateLimited' && failure.until !== undefined) this.cooldown.rest(url.origin, failure.until);
      throw failure;
    }
    const body = parseJson(await response.text().catch(() => ''));
    log(response.status, response.status >= 400 ? failedAnswerWords(response.status, where, body) : undefined);
    return { status: response.status, header, body };
  }

  private failureOf(status: number, header: HeaderOf, url: URL, where: string): TrackerError | null {
    if (status >= 300 && status < 400) {
      // A server behind single sign-on answers a refused credential with its login page.
      if (redirectsToLogin(header, url)) return new TrackerError('signInRefused', `${url.host} sent the request to its login page`, undefined, true);
      return new TrackerError('unexpected', `${where} sent the request elsewhere (${redirectHost(header, url)})`);
    }
    if (status === 401) return new TrackerError('signInRefused', `${url.host} refused the sign-in`);
    if (isRateLimited(status, header)) return new TrackerError('rateLimited', `${url.host} asked to wait`, restUntil(header, this.now()));
    return null;
  }
}

function headersOf(request: TrackerRequest, authorization: string | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'UVCS-Desktop' };
  if (authorization) headers.Authorization = authorization;
  if (request.json !== undefined) headers['Content-Type'] = 'application/json';
  if (request.form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  return headers;
}

function bodyOf(request: TrackerRequest): string | undefined {
  if (request.json !== undefined) return JSON.stringify(request.json);
  return request.form ? new URLSearchParams(request.form).toString() : undefined;
}

/** The most of a tracker's own error words the log keeps. */
const MAX_ANSWER_WORDS = 300;

/**
 * A failed answer for the command log: its status and the tracker's own words, Jira's `errorMessages` and `errors`,
 * GitHub's `message`, so a request the app got wrong (a 400) says why. Never shown to the user as they are.
 */
function failedAnswerWords(status: number, where: string, body: unknown): string {
  const words = answerWords(body).join(' ').slice(0, MAX_ANSWER_WORDS);
  return words ? `${status} from ${where}: ${words}` : `${status} from ${where}`;
}

function answerWords(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return [];
  const { errorMessages, errors, message } = body as Record<string, unknown>;
  const texts = (values: unknown[]) => values.filter((value): value is string => typeof value === 'string');
  return [
    ...(Array.isArray(errorMessages) ? texts(errorMessages) : []),
    ...(typeof errors === 'object' && errors !== null && !Array.isArray(errors) ? texts(Object.values(errors)) : []),
    ...(typeof message === 'string' ? [message] : []),
  ];
}

function parseJson(text: string): unknown {
  if (!/^\s*[[{]/.test(text)) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Whether a redirect leads to a login page: `login.jsp`, `/login`, a SAML or SSO servlet (`samlsso`). */
function redirectsToLogin(header: HeaderOf, url: URL): boolean {
  try {
    return /login|saml|sso/i.test(new URL(header('location') ?? '', url).pathname);
  } catch {
    return false;
  }
}

/** Where a redirect leads, by its host only: a redirect's address may carry a query. */
function redirectHost(header: HeaderOf, url: URL): string {
  try {
    return new URL(header('location') ?? '', url).host;
  } catch {
    return 'somewhere else';
  }
}
