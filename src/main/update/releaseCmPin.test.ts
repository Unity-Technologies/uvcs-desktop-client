import { describe, expect, it } from 'vitest';
import pin from '../../../cm-version.json';
import { readReleaseCmPin } from './releaseCmPin';

function answering(status: number, body: unknown = null) {
  const asked: string[] = [];
  const fetch = async (url: string) => {
    asked.push(url);
    return new Response(body === null ? null : JSON.stringify(body), { status });
  };
  return { fetch, asked };
}

describe('readReleaseCmPin', () => {
  it('reads the pin the release attaches', async () => {
    const site = answering(200, pin);
    expect(await readReleaseCmPin('1.2.0', site.fetch)).toEqual(pin);
    expect(site.asked).toEqual(['https://github.com/Unity-Technologies/uvcs-desktop-client/releases/download/v1.2.0/cm-version.json']);
  });

  it('has none for a release made before pins were attached', async () => {
    expect(await readReleaseCmPin('1.2.0', answering(404).fetch)).toBeNull();
  });

  it('fails on an answer that is no pin', async () => {
    await expect(readReleaseCmPin('1.2.0', answering(200, { version: 'latest', bundles: {} }).fetch)).rejects.toThrow('isn\'t four numbers');
    await expect(readReleaseCmPin('1.2.0', answering(503).fetch)).rejects.toThrow('HTTP 503');
  });
});
