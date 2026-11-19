import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmInstallFailureOf } from './cmInstallFailure';
import { downloadBundle } from './downloadBundle';
import { fakeBundleSite, sha256Of } from './testing/fakeBundleSite';

const URL = 'https://downloads.example/11.0.16.10659/client-linux.tar.gz';
const BUNDLE = new TextEncoder().encode('the bytes of a cm bundle');

async function partialPath(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'cm-download-')), '11.0.16.10659.partial');
}

describe('downloadBundle', () => {
  it('downloads the bundle, reporting each chunk against its size', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE }, {}, 10);
    const path = await partialPath();
    const progress: string[] = [];
    await downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: sha256Of(BUNDLE), onProgress: (received, total) => progress.push(`${received}/${total}`) });
    expect(await readFile(path)).toEqual(Buffer.from(BUNDLE));
    expect(progress).toEqual(['0/24', '10/24', '20/24', '24/24']);
    expect(site.requests).toEqual([`GET ${URL}`]);
  });

  it('resumes what an earlier attempt left, and checks the whole file', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE });
    const path = await partialPath();
    await writeFile(path, BUNDLE.subarray(0, 9));
    const progress: string[] = [];
    await downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: sha256Of(BUNDLE), onProgress: (received, total) => progress.push(`${received}/${total}`) });
    expect(await readFile(path)).toEqual(Buffer.from(BUNDLE));
    expect(site.requests).toEqual([`GET ${URL} bytes=9-`]);
    expect(progress[0]).toBe('9/24');
  });

  it('asks nothing when what was kept is the whole bundle already, as published', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE });
    const path = await partialPath();
    await writeFile(path, BUNDLE);
    const progress: string[] = [];
    await downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: sha256Of(BUNDLE), onProgress: (received, total) => progress.push(`${received}/${total}`) });
    expect(site.requests).toEqual([]);
    expect(progress).toEqual(['24/24']);
  });

  it('starts over when the site answers the whole file to a range', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE }, { honorsRanges: false });
    const path = await partialPath();
    await writeFile(path, BUNDLE.subarray(0, 9));
    await downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: sha256Of(BUNDLE), onProgress: () => undefined });
    expect(await readFile(path)).toEqual(Buffer.from(BUNDLE));
  });

  it('starts over when what was kept is as long as the bundle or longer', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE });
    const path = await partialPath();
    await writeFile(path, 'x'.repeat(40));
    await downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: sha256Of(BUNDLE), onProgress: () => undefined });
    expect(await readFile(path)).toEqual(Buffer.from(BUNDLE));
    expect(site.requests).toEqual([`GET ${URL} bytes=40-`, `GET ${URL}`]);
  });

  it('deletes a bundle whose SHA-256 differs from the pin, and fails as damaged', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE });
    const path = await partialPath();
    const download = downloadBundle({ fetch: site.fetch, url: URL, partialPath: path, sha256: 'f'.repeat(64), onProgress: () => undefined });
    await expect(download.catch(cmInstallFailureOf)).resolves.toBe('damaged');
    expect(existsSync(path)).toBe(false);
  });

  it('fails as unavailable when the site has no such bundle', async () => {
    const site = fakeBundleSite({});
    const download = downloadBundle({ fetch: site.fetch, url: URL, partialPath: await partialPath(), sha256: sha256Of(BUNDLE), onProgress: () => undefined });
    await expect(download.catch(cmInstallFailureOf)).resolves.toBe('unavailable');
  });

  it('fails as a proxy sign-in when a proxy asks for one', async () => {
    const site = fakeBundleSite({ [URL]: BUNDLE }, { status: 407 });
    const download = downloadBundle({ fetch: site.fetch, url: URL, partialPath: await partialPath(), sha256: sha256Of(BUNDLE), onProgress: () => undefined });
    await expect(download.catch(cmInstallFailureOf)).resolves.toBe('proxyAuthentication');
  });
});
