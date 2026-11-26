import { createHash, type Hash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, rm, stat } from 'node:fs/promises';
import { CmInstallError, httpFailure } from './cmInstallFailure';

/**
 * Fetches a URL: Electron's `net.fetch` in the app, which goes through the system's proxy, PAC script and certificates
 * as Chromium does (Node's own `fetch` knows none of them); the global `fetch` in tests.
 */
export type Fetch = (url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => Promise<Response>;

export interface BundleDownload {
  fetch: Fetch;
  url: string;
  /** Where the bundle downloads: a download cut short resumes from what it holds. */
  partialPath: string;
  /**
   * The SHA-256 the pin holds: anything else is deleted and fails as `damaged`. Null for a file with none published
   * (the official installer, whose signature is checked instead): then only its length is, against what the site said.
   */
  sha256: string | null;
  onProgress: (receivedBytes: number, totalBytes: number | null) => void;
  /** Timers for the stall watch (`STALL_TIMEOUT_MS`); the tests' own. */
  timers?: StallTimers;
  /** Stops the download when its caller no longer needs it: it fails with the signal's reason, keeping what arrived. */
  signal?: AbortSignal;
}

export interface StallTimers {
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

const SYSTEM_TIMERS: StallTimers = { setTimeout: (run, ms) => setTimeout(run, ms), clearTimeout: (timer) => clearTimeout(timer as NodeJS.Timeout) };

/**
 * How long a download may go without a byte before it fails as `unreachable` (and is tried again, resuming): a
 * connection a captive portal or a proxy keeps open without sending anything never ends by itself, and Chromium sets no
 * limit on a body that stopped arriving.
 */
export const STALL_TIMEOUT_MS = 60_000;

/** Aborts what it watches once `STALL_TIMEOUT_MS` pass without `alive()`. */
function stallWatch(url: string, timers: StallTimers) {
  const controller = new AbortController();
  const stall = (): void => controller.abort(new CmInstallError('unreachable', `No data for ${STALL_TIMEOUT_MS / 1000} s from ${url}`));
  let timer = timers.setTimeout(stall, STALL_TIMEOUT_MS);
  return {
    signal: controller.signal,
    alive: (): void => {
      timers.clearTimeout(timer);
      timer = timers.setTimeout(stall, STALL_TIMEOUT_MS);
    },
    stop: (): void => timers.clearTimeout(timer),
    /** The stall's own error, when it was what stopped the download. */
    reasonFor: (error: unknown): unknown => (controller.signal.aborted ? controller.signal.reason : error),
  };
}

async function sizeOf(path: string): Promise<number> {
  try {
    return (await stat(path)).size;
  } catch {
    return 0;
  }
}

async function hashFile(path: string, hash: Hash): Promise<void> {
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
}

/** The bundle's size: the answer's length, plus what a resumed download already holds. */
function totalOf(response: Response, resumedFrom: number): number | null {
  const length = Number(response.headers.get('content-length'));
  return Number.isFinite(length) && length > 0 ? resumedFrom + length : null;
}

/**
 * Downloads a bundle into `partialPath`, resuming what an earlier attempt left there (a `Range` request: the download
 * site answers 206), and checks its SHA-256, when one is published. A site that answers the whole file again (200)
 * starts it over. A body that ends short of the length the site said fails as `unreachable`, keeping what arrived.
 */
export async function downloadBundle(download: BundleDownload): Promise<void> {
  const { url, partialPath, sha256, onProgress } = download;
  let resumedFrom = await sizeOf(partialPath);
  const kept = createHash('sha256');
  // With no SHA-256 to check, what was kept isn't read again.
  if (resumedFrom > 0 && sha256 !== null) await hashFile(partialPath, kept);
  // What an earlier attempt kept is the whole bundle already (it failed after downloading): nothing to ask.
  if (sha256 !== null && resumedFrom > 0 && kept.copy().digest('hex') === sha256) {
    onProgress(resumedFrom, resumedFrom);
    return;
  }
  const watch = stallWatch(url, download.timers ?? SYSTEM_TIMERS);
  const hash = createHash('sha256');
  try {
    resumedFrom = await receive(download, resumedFrom, kept, hash, watch);
  } catch (error) {
    throw watch.reasonFor(error);
  } finally {
    watch.stop();
  }
  if (sha256 === null) return;
  const received = (resumedFrom > 0 ? kept : hash).digest('hex');
  if (received !== sha256) {
    await rm(partialPath, { force: true });
    throw new CmInstallError('damaged', `${url} has SHA-256 ${received}; the app expects ${sha256}`);
  }
}

/**
 * Asks for the bundle, or the rest of it, and writes what arrives to `partialPath`, into `kept` when it resumes or
 * `fresh` when it starts over. Returns where it resumed from: 0 when it started over.
 */
async function receive(download: BundleDownload, from: number, kept: Hash, fresh: Hash, watch: ReturnType<typeof stallWatch>): Promise<number> {
  const { fetch, url, partialPath, onProgress } = download;
  const signal = download.signal ? AbortSignal.any([watch.signal, download.signal]) : watch.signal;
  let resumedFrom = from;
  let response = await fetch(url, { headers: resumedFrom > 0 ? { Range: `bytes=${resumedFrom}-` } : {}, signal });
  if (response.status === 416) {
    // What was kept is no beginning of the bundle (it's as long or longer): start over.
    await response.body?.cancel();
    resumedFrom = 0;
    response = await fetch(url, { headers: {}, signal });
  }
  if (!response.ok || !response.body) throw new CmInstallError(httpFailure(response.status), `HTTP ${response.status} from ${url}`);
  if (response.status !== 206) resumedFrom = 0;

  const hash = resumedFrom > 0 ? kept : fresh;
  const totalBytes = totalOf(response, resumedFrom);
  let receivedBytes = resumedFrom;
  onProgress(receivedBytes, totalBytes);
  const file = await open(partialPath, resumedFrom > 0 ? 'a' : 'w');
  try {
    for await (const chunk of response.body) {
      watch.alive();
      hash.update(chunk);
      await file.write(chunk);
      receivedBytes += chunk.byteLength;
      onProgress(receivedBytes, totalBytes);
    }
  } finally {
    await file.close();
  }
  if (totalBytes !== null && receivedBytes < totalBytes) {
    throw new CmInstallError('unreachable', `${url} ended after ${receivedBytes} of ${totalBytes} bytes`);
  }
  return resumedFrom;
}
