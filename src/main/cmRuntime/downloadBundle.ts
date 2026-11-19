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
  /** The SHA-256 the pin holds: anything else is deleted and fails as `damaged`. */
  sha256: string;
  onProgress: (receivedBytes: number, totalBytes: number | null) => void;
  signal?: AbortSignal;
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
 * site answers 206), and checks its SHA-256. A site that answers the whole file again (200) starts it over.
 */
export async function downloadBundle(download: BundleDownload): Promise<void> {
  const { fetch, url, partialPath, sha256, onProgress, signal } = download;
  let resumedFrom = await sizeOf(partialPath);
  let response = await fetch(url, { headers: resumedFrom > 0 ? { Range: `bytes=${resumedFrom}-` } : {}, signal });
  if (response.status === 416) {
    // What was kept is no beginning of the bundle (it's as long or longer): start over.
    await response.body?.cancel();
    resumedFrom = 0;
    response = await fetch(url, { headers: {}, signal });
  }
  if (!response.ok || !response.body) throw new CmInstallError(httpFailure(response.status), `HTTP ${response.status} from ${url}`);
  if (response.status !== 206) resumedFrom = 0;

  const hash = createHash('sha256');
  if (resumedFrom > 0) await hashFile(partialPath, hash);
  const totalBytes = totalOf(response, resumedFrom);
  let receivedBytes = resumedFrom;
  onProgress(receivedBytes, totalBytes);
  const file = await open(partialPath, resumedFrom > 0 ? 'a' : 'w');
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      await file.write(chunk);
      receivedBytes += chunk.byteLength;
      onProgress(receivedBytes, totalBytes);
    }
  } finally {
    await file.close();
  }
  const received = hash.digest('hex');
  if (received !== sha256) {
    await rm(partialPath, { force: true });
    throw new CmInstallError('damaged', `${url} has SHA-256 ${received}; the app expects ${sha256}`);
  }
}
