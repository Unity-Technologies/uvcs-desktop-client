import { describe, expect, it, vi } from 'vitest';

/** A fresh module each test: whether people showed is kept for the window in module state. */
const freshPeopleShown = async () => {
  vi.resetModules();
  return import('./peopleShown');
};

describe('people shown', () => {
  it('are none until someone named by an email address shows', async () => {
    const { havePeopleShown, notePersonShown } = await freshPeopleShown();
    expect(havePeopleShown()).toBe(false);

    notePersonShown('daniel');
    expect(havePeopleShown()).toBe(false);

    notePersonShown('ana@unity.com');
    expect(havePeopleShown()).toBe(true);
  });

  it('are told to listeners once, after the render that showed them', async () => {
    const { notePersonShown, subscribeToPeopleShown } = await freshPeopleShown();
    const listener = vi.fn();
    subscribeToPeopleShown(listener);

    notePersonShown('ana@unity.com');
    notePersonShown('ben@unity.com');
    expect(listener).not.toHaveBeenCalled();
    await Promise.resolve();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
