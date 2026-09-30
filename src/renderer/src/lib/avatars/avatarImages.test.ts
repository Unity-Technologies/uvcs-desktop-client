import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Stands for the browser's `Image`: loads any data URL but `data:broken`. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    queueMicrotask(() => (url === 'data:broken' ? this.onerror?.() : this.onload?.()));
  }
}

/** A fresh module each test: the images are kept for the session in module state. */
const freshAvatarImages = async () => {
  vi.resetModules();
  return import('./avatarImages');
};

/** Resolves once every avatar load started so far has finished. */
const loadsFinished = () => new Promise((resolve) => setTimeout(resolve, 0));

const gravatarCalls = () => fakeApi.argsOf('system.gravatar').map(([email]) => email);

beforeEach(() => {
  fakeApi.answer('system.gravatar', (email: string) => (email === 'nobody@example.com' ? null : `data:${email}`));
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

  it('asks main once per user for the whole session, however the name is spelled', async () => {
    const { avatarImageFor } = await freshAvatarImages();

    avatarImageFor('Ana@Example.com');
    avatarImageFor(' ana@example.com ');
    await loadsFinished();
    avatarImageFor('ana@example.com');

    expect(gravatarCalls()).toEqual(['ana@example.com']);
  });

  it('keeps showing initials for someone without a picture, or whose picture does not load, without asking again', async () => {
    const { avatarImageFor } = await freshAvatarImages();
    fakeApi.answer('system.gravatar', (email: string) => {
      if (email === 'broken@example.com') return 'data:broken';
      throw new Error('offline');
    });

    avatarImageFor('broken@example.com');
    avatarImageFor('offline@example.com');
    await loadsFinished();

    expect(avatarImageFor('broken@example.com')).toBeNull();
    expect(avatarImageFor('offline@example.com')).toBeNull();
    expect(gravatarCalls()).toEqual(['broken@example.com', 'offline@example.com']);
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
  it('turned off, shows initials everywhere and fetches nothing', async () => {
    const { avatarImageFor, setAvatarImagesEnabled } = await freshAvatarImages();
    avatarImageFor('ana@example.com');
    await loadsFinished();

    setAvatarImagesEnabled(false);

    expect(avatarImageFor('ana@example.com')).toBeNull();
    avatarImageFor('ben@example.com');
    expect(gravatarCalls()).toEqual(['ana@example.com']);
  });

  it('turned back on, asks again for the pictures that came back empty', async () => {
    const { avatarImageFor, setAvatarImagesEnabled } = await freshAvatarImages();
    fakeApi.answer('system.gravatar', () => {
      throw new Error('offline');
    });
    avatarImageFor('ana@example.com');
    await loadsFinished();
    setAvatarImagesEnabled(false);
    fakeApi.answer('system.gravatar', () => 'data:ana');

    setAvatarImagesEnabled(true);
    avatarImageFor('ana@example.com');
    await loadsFinished();

    expect(gravatarCalls()).toEqual(['ana@example.com', 'ana@example.com']);
    expect(avatarImageFor('ana@example.com')).toBeInstanceOf(FakeImage);
  });
});
