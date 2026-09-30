import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { downloadInstaller } from './downloadInstaller';

const image = new Uint8Array(1000).map((_, index) => index % 251);
const sha512 = createHash('sha512').update(image).digest('base64');

/** A server answering with the image in chunks of 100 bytes. */
function serving(bytes: Uint8Array, headers: Record<string, string> = { 'content-length': String(bytes.length) }) {
  return vi.fn(async (_url: string) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let start = 0; start < bytes.length; start += 100) controller.enqueue(bytes.slice(start, start + 100));
        controller.close();
      },
    });
    return new Response(body, { headers });
  });
}

async function destination(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), 'installer-')), 'UnityVersionControl-1.2.0-macOS-arm64.dmg');
}

describe('downloadInstaller', () => {
  it('writes the checked installer, reporting each whole percent once', async () => {
    const path = await destination();
    const fetchFile = serving(image);
    const percents: number[] = [];

    await downloadInstaller(fetchFile, { url: 'https://host/image.dmg', destination: path, sha512 }, (percent) => percents.push(percent));

    expect(fetchFile).toHaveBeenCalledWith('https://host/image.dmg');
    expect(new Uint8Array(await readFile(path))).toEqual(image);
    expect(percents).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("measures by the release's size when the server sends no length", async () => {
    const percents: number[] = [];
    await downloadInstaller(serving(image, {}), { url: 'u', destination: await destination(), sha512, size: 2000 }, (percent) => percents.push(percent));

    expect(percents.at(-1)).toBe(50);
  });

  it('keeps an installer already downloaded whole, without downloading again', async () => {
    const path = await destination();
    await writeFile(path, image);
    const fetchFile = serving(image);

    await downloadInstaller(fetchFile, { url: 'u', destination: path, sha512 }, () => undefined);

    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('downloads again over a file that is not the installer', async () => {
    const path = await destination();
    await writeFile(path, 'half an image');

    await downloadInstaller(serving(image), { url: 'u', destination: path, sha512 }, () => undefined);

    expect(new Uint8Array(await readFile(path))).toEqual(image);
  });

  it('leaves nothing behind when the download is damaged', async () => {
    const path = await destination();
    const damaged = image.slice();
    damaged[500] = 0xff;

    await expect(downloadInstaller(serving(damaged), { url: 'u', destination: path, sha512 }, () => undefined)).rejects.toThrow('damaged');
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.download`)).toBe(false);
  });

  it('fails with the HTTP status the server answered', async () => {
    const notFound = vi.fn(async () => new Response('Not Found', { status: 404 }));

    await expect(downloadInstaller(notFound, { url: 'u', destination: await destination(), sha512 }, () => undefined)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
