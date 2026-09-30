import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { SelectionState } from '../../lib/selection';

import { afterLeaving, guardLeaving, guardUnloading, selectAfterLeaving, settleBeforeLeaving } from './leaveGuard';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

describe('leaveGuard', () => {
  it('leaves at once when nothing guards the way out', async () => {
    const leave = vi.fn();
    afterLeaving(leave);
    expect(leave).toHaveBeenCalledOnce();
    await expect(settleBeforeLeaving()).resolves.toBe(true);
  });

  it('leaves once the guard lets it go, and stays when it says so', async () => {
    let answer = true;
    const lift = guardLeaving(async () => answer);
    const leave = vi.fn();
    afterLeaving(leave);
    expect(leave).not.toHaveBeenCalled();
    await flush();
    expect(leave).toHaveBeenCalledOnce();

    answer = false;
    afterLeaving(leave);
    await flush();
    expect(leave).toHaveBeenCalledOnce();
    await expect(settleBeforeLeaving()).resolves.toBe(false);
    lift();
  });

  it('asks once: ways out tried while the guard asks are dropped', async () => {
    let answer: (canLeave: boolean) => void = () => {};
    const guard = vi.fn(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const lift = guardLeaving(guard);
    const first = vi.fn();
    const second = vi.fn();
    afterLeaving(first);
    afterLeaving(second);
    answer(true);
    await flush();
    expect(guard).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    lift();
  });

  it('lifts only its own guard', () => {
    const liftOld = guardLeaving(async () => false);
    const liftNew = guardLeaving(async () => false);
    liftOld();
    const leave = vi.fn();
    afterLeaving(leave);
    expect(leave).not.toHaveBeenCalled();
    liftNew();
    afterLeaving(leave);
    expect(leave).toHaveBeenCalledOnce();
  });
});

describe('selectAfterLeaving', () => {
  const selection = (...keys: string[]): SelectionState => ({ selected: new Set(keys), anchor: keys[0] ?? null });

  it('selects another row once the guard lets go of the one shown', async () => {
    const lift = guardLeaving(async () => true);
    const select = vi.fn();
    selectAfterLeaving(selection('a'), selection('b'), select);
    expect(select).not.toHaveBeenCalled();
    await settleBeforeLeaving();
    expect(select).toHaveBeenCalledWith(selection('b'));
    lift();
  });

  it('keeps the row when the user stays', async () => {
    const lift = guardLeaving(async () => false);
    const select = vi.fn();
    selectAfterLeaving(selection('a'), selection('a', 'b'), select);
    await settleBeforeLeaving();
    expect(select).not.toHaveBeenCalled();
    lift();
  });

  it('never asks when the selection stays the same (the row clicked again)', () => {
    const guard = vi.fn(async () => false);
    const lift = guardLeaving(guard);
    const select = vi.fn();
    selectAfterLeaving(selection('a'), selection('a'), select);
    expect(select).toHaveBeenCalledOnce();
    expect(guard).not.toHaveBeenCalled();
    lift();
  });
});

describe('guardUnloading', () => {
  guardUnloading();

  /** Whether closing, quitting or reloading the page would be held back now. */
  function unloadingHeldBack(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  /** The main process asks before closing the window; resolves with whether the window answered it may leave. */
  async function closeWindow(): Promise<unknown> {
    const answered = new Promise((resolve) => fakeApi.answer('windows.continueLeaving', (canLeave: boolean) => void resolve(canLeave)));
    fakeApi.emit('leaveRequested', {});
    return answered;
  }

  it('lets the page unload when nothing guards it', () => {
    expect(unloadingHeldBack()).toBe(false);
  });

  it('holds the unloading back while something guards it', () => {
    const lift = guardLeaving(async () => true);
    expect(unloadingHeldBack()).toBe(true);
    lift();
  });

  it('closes the window once the guard lets go, without asking again as it unloads', async () => {
    const lift = guardLeaving(async () => true);
    await expect(closeWindow()).resolves.toBe(true);
    expect(unloadingHeldBack()).toBe(false);
    lift();
  });

  it('keeps the window when the user cancels', async () => {
    const lift = guardLeaving(async () => false);
    await expect(closeWindow()).resolves.toBe(false);
    expect(unloadingHeldBack()).toBe(true);
    lift();
  });

  it('asks again after a new guard, even once the window was let go', async () => {
    const liftFirst = guardLeaving(async () => true);
    await closeWindow();
    liftFirst();
    const lift = guardLeaving(async () => true);
    expect(unloadingHeldBack()).toBe(true);
    lift();
  });
});
