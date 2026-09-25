import { describe, expect, it, vi } from 'vitest';
import { GravatarCache, gravatarUrl } from './gravatar';

describe('gravatarUrl', () => {
  it('hashes the trimmed, lowercased email and asks for a 404 when there is no picture', () => {
    expect(gravatarUrl(' Someone@Example.com ', 96)).toBe(
      'https://gravatar.com/avatar/72497f475e4f76d0b28f57c73a084ece576d170874eba3ee2609d9afe4b71aab?s=96&d=404',
    );
  });

  it('is null for users that are not email addresses', () => {
    expect(gravatarUrl('daniel', 96)).toBeNull();
  });
});

describe('GravatarCache', () => {
  it('turns a picture into a data URL', async () => {
    const cache = new GravatarCache(async () => ({ type: 'image/png', bytes: new Uint8Array([1, 2, 3]) }));
    expect(await cache.picture('a@b.com', 96)).toBe('data:image/png;base64,AQID');
  });

  it('asks once per user and size, remembering missing pictures and failures too', async () => {
    const fetchImage = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('offline'));
    const cache = new GravatarCache(fetchImage);
    expect(await cache.picture('a@b.com', 96)).toBeNull();
    expect(await cache.picture('A@b.com', 96)).toBeNull();
    expect(await cache.picture('c@d.com', 96)).toBeNull();
    expect(await cache.picture('c@d.com', 96)).toBeNull();
    expect(fetchImage).toHaveBeenCalledTimes(2);
  });

  it('never asks for users that are not email addresses', async () => {
    const fetchImage = vi.fn();
    expect(await new GravatarCache(fetchImage).picture('daniel', 96)).toBeNull();
    expect(fetchImage).not.toHaveBeenCalled();
  });
});
