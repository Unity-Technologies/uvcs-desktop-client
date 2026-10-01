import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { UpdateFailure } from './updateError';

export interface InstallerDownload {
  url: string;
  /** Where the installer ends up; it only appears there whole and checked. */
  destination: string;
  /** Its checksum as the release lists it (base64, `latest-mac.yml`). */
  sha512: string;
  /** Its size as the release lists it, for the progress when the server sends no length. */
  size?: number;
}

/**
 * Downloads a release's installer, reporting whole percents as they change, and checks it against the release's
 * checksum: electron-updater checks what it downloads itself, and a disk image the user opens deserves no less. A file
 * already there with that checksum (downloaded before the app restarted) is kept instead. It downloads into
 * `<destination>.download`, so a download cut short never looks like an installer.
 */
export async function downloadInstaller(
  fetchFile: (url: string) => Promise<Response>,
  download: InstallerDownload,
  onProgress: (percent: number) => void,
): Promise<void> {
  if ((await sha512Of(download.destination).catch(() => null)) === download.sha512) return;

  const response = await fetchFile(download.url);
  if (!response.ok || !response.body) throw Object.assign(new Error(`Download failed: HTTP ${response.status}`), { statusCode: response.status });
  const total = Number(response.headers.get('content-length')) || download.size || 0;
  const partial = `${download.destination}.download`;
  const hash = createHash('sha512');
  let received = 0;
  let lastPercent = -1;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      hash.update(chunk);
      received += chunk.length;
      const percent = total ? Math.min(100, Math.floor((received / total) * 100)) : 0;
      if (percent !== lastPercent) onProgress((lastPercent = percent));
      done(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>), measure, createWriteStream(partial));
    if (hash.digest('base64') !== download.sha512) throw new UpdateFailure('The download was damaged. Try again.');
    await rename(partial, download.destination);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

async function sha512Of(path: string): Promise<string> {
  const hash = createHash('sha512');
  await pipeline(createReadStream(path), hash);
  return hash.digest('base64');
}
