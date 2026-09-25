import { describe, expect, it, vi } from 'vitest';
import { afterLeaving, guardLeaving, settleBeforeLeaving } from './leaveGuard';

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
