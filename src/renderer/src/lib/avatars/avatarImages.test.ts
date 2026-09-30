import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvatarPictureSource } from './avatarImages';

/** Stands for the browser's `Image`: loads any data URL but `data:broken`. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    queueMicrotask(() => (url === 'data:broken' ? this.onerror?.() : this.onload?.()));
  }
}

/** The users whose pictures were fetched, in order. */
let fetched: string[] = [];
/** How the source answers: a data URL for a picture, null for none, or it throws. */
let answer: (user: string) => string | null = (user) => (user === 'nobody@example.com' ? null : `data:${user}`);
const source: AvatarPictureSource = async (user) => {
  fetched.push(user);
  return answer(user);
};

/** A fresh module each test, taking pictures from `source`: the images are kept for the session in module state. */
const freshAvatarImages = async () => {
  vi.resetModules();
  const avatarImages = await import('./avatarImages');
  avatarImages.setAvatarPictureSource(source);
  return avatarImages;
};

/** Resolves once every avatar load started so far has finished. */
const loadsFinished = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  fetched = [];
  answer = (user) => (user === 'nobody@example.com' ? null : `data:${user}`);
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

describe('avatarImageFor', () => {
  it('shows initials until the picture has loaded, then the picture', async () => {
    const { avatarImageFor } = await freshAvatarImages();

    expect(avatarImageFor('ana@example.com')).toBeNull();
    await loadsFinished();

    expect(avatarImageFor('ana@example.com')).toBeInstanceOf(FakeImage);
  });

  it('asks once per user for the whole session, however the name is spelled', async () => {
    const { avatarImageFor } = await freshAvatarImages();

    avatarImageFor('Ana@Example.com');
    avatarImageFor(' ana@example.com ');
    await loadsFinished();
    avatarImageFor('ana@example.com');

    expect(fetched).toEqual(['ana@example.com']);
  });

  it('keeps showing initials for someone without a picture, or whose picture does not load, without asking again', async () => {
    const { avatarImageFor } = await freshAvatarImages();
    answer = (user) => {
      if (user === 'broken@example.com') return 'data:broken';
      throw new Error('offline');
    };

    avatarImageFor('broken@example.com');
    avatarImageFor('offline@example.com');
    await loadsFinished();

    expect(avatarImageFor('broken@example.com')).toBeNull();
    expect(avatarImageFor('offline@example.com')).toBeNull();
    expect(fetched).toEqual(['broken@example.com', 'offline@example.com']);
  });

  it('tells subscribers when a picture arrives, so a canvas can repaint', async () => {
    const { avatarImageFor, subscribeToAvatars } = await freshAvatarImages();
    const repaint = vi.fn();
    subscribeToAvatars(repaint);

    avatarImageFor('ana@example.com');
    avatarImageFor('nobody@example.com');
    await loadsFinished();

    expect(repaint).toHaveBeenCalledTimes(1);
  });
});

describe('the Gravatar setting', () => {
  it('not read yet, shows initials and fetches nothing', async () => {
    vi.resetModules();
    const { avatarImageFor } = await import('./avatarImages');

    expect(avatarImageFor('ana@example.com')).toBeNull();
    expect(fetched).toEqual([]);
  });

  it('turned off, shows initials everywhere and fetches nothing', async () => {
    const { avatarImageFor, setAvatarPictureSource } = await freshAvatarImages();
    avatarImageFor('ana@example.com');
    await loadsFinished();

    setAvatarPictureSource(null);

    expect(avatarImageFor('ana@example.com')).toBeNull();
    avatarImageFor('ben@example.com');
    expect(fetched).toEqual(['ana@example.com']);
  });

  it('turned back on, asks again for the pictures that came back empty', async () => {
    const { avatarImageFor, setAvatarPictureSource } = await freshAvatarImages();
    answer = () => {
      throw new Error('offline');
    };
    avatarImageFor('ana@example.com');
    await loadsFinished();
    setAvatarPictureSource(null);
    answer = () => 'data:ana';

    setAvatarPictureSource(source);
    avatarImageFor('ana@example.com');
    await loadsFinished();

    expect(fetched).toEqual(['ana@example.com', 'ana@example.com']);
    expect(avatarImageFor('ana@example.com')).toBeInstanceOf(FakeImage);
  });
});
