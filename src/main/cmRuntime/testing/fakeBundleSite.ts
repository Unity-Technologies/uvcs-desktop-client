import { createHash } from 'node:crypto';
import type { Fetch } from '../downloadBundle';

export interface FakeBundleSite {
  fetch: Fetch;
  /** The requests made, as `GET <url>` with the range asked, if any: `GET <url> bytes=10-`. */
  requests: string[];
}

export interface FakeBundleSiteOptions {
  /** Answers ranges with 206 (the default), or the whole file with 200, as a server that ignores them does. */
  honorsRanges?: boolean;
  /** The status every request gets instead of the bundle: 404, 407, 500. */
  status?: number;
  /** Fails every request as a network error would. */
  error?: Error;
  /** Sends this many bytes, then nothing more, the connection left open until the request is aborted. */
  stallsAfter?: number;
  /** Sends this many bytes, then ends the body as if whole, though its length said more: a connection cut cleanly. */
  endsAfter?: number;
}

/** The SHA-256 of some bytes, as the pin holds it. */
export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * A download site serving files from memory, as the real one serves bundles: a `Range` request answered 206 with the
 * rest (or 416 when it starts past the end), a missing file 404. The body arrives in chunks of `chunkSize`.
 */
export function fakeBundleSite(files: Record<string, Uint8Array>, options: FakeBundleSiteOptions = {}, chunkSize = 4): FakeBundleSite {
  const requests: string[] = [];
  const fetch: Fetch = async (url, init) => {
    const range = init.headers.Range;
    requests.push(range ? `GET ${url} ${range}` : `GET ${url}`);
    if (options.error) throw options.error;
    if (options.status) return new Response(null, { status: options.status });
    const file = files[url];
    if (!file) return new Response(null, { status: 404 });
    const start = range && options.honorsRanges !== false ? Number(/bytes=(\d+)-/.exec(range)?.[1] ?? 0) : 0;
    if (start >= file.length && start > 0) return new Response(null, { status: 416 });
    const body = file.subarray(start);
    const sent = body.subarray(0, options.stallsAfter ?? options.endsAfter ?? body.length);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < sent.length; offset += chunkSize) controller.enqueue(sent.subarray(offset, offset + chunkSize));
        if (options.stallsAfter === undefined) controller.close();
        else init.signal?.addEventListener('abort', () => controller.error(init.signal?.reason));
      },
    });
    return new Response(stream, { status: start > 0 ? 206 : 200, headers: { 'content-length': String(body.length) } });
  };
  return { fetch, requests };
}
