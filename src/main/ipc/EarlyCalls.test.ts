import { describe, expect, it, vi } from 'vitest';
import type { ApiMethod } from './apiMethods';
import { callKey, EARLY_ANSWER_MS, EarlyCalls } from './EarlyCalls';

/** Early calls over `methods`, with the drops they schedule kept to run by hand. */
function earlyCalls(methods: Record<string, ApiMethod>) {
  const drops: { drop: () => void; ms: number }[] = [];
  const early = new EarlyCalls(new Map(Object.entries(methods)), (drop, ms) => void drops.push({ drop, ms }));
  return { early, drops };
}

describe('EarlyCalls', () => {
  it("answers the page's first call with the same arguments from the call made early, without calling again", async () => {
    const info = vi.fn(async (path: unknown) => ({ path }));
    const { early } = earlyCalls({ 'workspaces.info': info });

    early.start('workspaces.info', ['/wk']);

    expect(await early.take('workspaces.info', ['/wk'])).toEqual({ path: '/wk' });
    expect(early.take('workspaces.info', ['/wk'])).toBeUndefined();
    expect(info).toHaveBeenCalledTimes(1);
  });

  it('answers nothing for other arguments or another method', () => {
    const { early } = earlyCalls({ 'workspaces.info': async () => ({}), 'workspaces.list': async () => [] });

    early.start('workspaces.info', ['/wk']);

    expect(early.take('workspaces.info', ['/other'])).toBeUndefined();
    expect(early.take('workspaces.list', [])).toBeUndefined();
  });

  it('matches arguments whatever order their objects hold their keys in, as they cross IPC', async () => {
    const { early } = earlyCalls({ 'pendingChanges.list': async () => 'changes' });

    early.start('pendingChanges.list', ['/wk', { private: true, ignored: false }]);

    expect(await early.take('pendingChanges.list', ['/wk', { ignored: false, private: true }])).toBe('changes');
  });

  it('hands a failure to the call that takes it, as if that call had failed, and leaves none unhandled meanwhile', async () => {
    const { early } = earlyCalls({
      'system.cmVersion': async () => {
        throw new Error('cm not found');
      },
    });

    early.start('system.cmVersion', []);
    await new Promise((resolve) => setImmediate(resolve));

    await expect(early.take('system.cmVersion', [])).rejects.toThrow('cm not found');
  });

  it('drops an answer nobody took in time, so a later call reads afresh', () => {
    const { early, drops } = earlyCalls({ 'workspaces.list': async () => [] });

    early.start('workspaces.list', []);
    expect(drops.map(({ ms }) => ms)).toEqual([EARLY_ANSWER_MS]);
    drops[0]!.drop();

    expect(early.take('workspaces.list', [])).toBeUndefined();
  });

  it("refuses a method the API doesn't have", () => {
    const { early } = earlyCalls({});

    expect(() => early.start('workspaces.nothing', [])).toThrow('Unknown API method workspaces.nothing');
  });
});

describe('callKey', () => {
  it('tells calls apart by method and by every argument, nested objects included', () => {
    expect(callKey('a.b', [{ x: { p: 1, q: 2 } }])).toBe(callKey('a.b', [{ x: { q: 2, p: 1 } }]));
    expect(callKey('a.b', ['/wk'])).not.toBe(callKey('a.c', ['/wk']));
    expect(callKey('a.b', [['x', 'y']])).not.toBe(callKey('a.b', [['y', 'x']]));
  });
});
