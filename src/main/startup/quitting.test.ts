import { describe, expect, it, vi } from 'vitest';
import { Quitting, type QuittingDependencies } from './quitting';

vi.mock('electron', async () => (await import('../window/testing/fakeElectron')).fakeElectron.module);

/** A quit with an operation running or not; the user answers `answer` when asked. */
function setUp({ writing = false, windows = true, answer = true } = {}) {
  let finishWrites!: () => void;
  const writesFinished = new Promise<void>((resolve) => (finishWrites = resolve));
  const dependencies = {
    writesRunning: vi.fn(() => writing),
    writesFinished: vi.fn(() => writesFinished),
    askToQuitWhenDone: vi.fn(async () => answer),
    hasWindows: () => windows,
    saveSession: vi.fn(),
    quit: vi.fn(),
  } satisfies QuittingDependencies;
  const quitting = new Quitting(dependencies);
  /** Quits as Electron does (`before-quit`): whether the quit went on. */
  const quit = (): boolean => {
    let held = false;
    quitting.beforeQuit({ preventDefault: () => void (held = true) });
    return !held;
  };
  return { dependencies, quit, finishWrites: () => ((writing = false), finishWrites()) };
}

/** Lets the awaited steps of the quit run. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('quitting', () => {
  it('goes on at once when no operation changes a workspace, saving the windows before they close', () => {
    const { dependencies, quit } = setUp();

    expect(quit()).toBe(true);
    expect(dependencies.askToQuitWhenDone).not.toHaveBeenCalled();
    expect(dependencies.saveSession).toHaveBeenCalledOnce();
  });

  it('waits for a running operation once the user agrees, then quits', async () => {
    const { dependencies, quit, finishWrites } = setUp({ writing: true });

    expect(quit()).toBe(false);
    await settle();
    expect(dependencies.askToQuitWhenDone).toHaveBeenCalledOnce();
    expect(dependencies.quit).not.toHaveBeenCalled();
    // Saved by the quit that goes on, with the windows as they are then.
    expect(dependencies.saveSession).not.toHaveBeenCalled();

    finishWrites();
    await settle();
    expect(dependencies.quit).toHaveBeenCalledOnce();
    expect(quit()).toBe(true);
  });

  it('stays when the user cancels, and asks again on the next quit', async () => {
    const { dependencies, quit } = setUp({ writing: true, answer: false });

    expect(quit()).toBe(false);
    await settle();
    expect(dependencies.writesFinished).not.toHaveBeenCalled();
    expect(dependencies.quit).not.toHaveBeenCalled();

    expect(quit()).toBe(false);
    await settle();
    expect(dependencies.askToQuitWhenDone).toHaveBeenCalledTimes(2);
  });

  it('asks once: quitting again while it waits holds the quit back again', async () => {
    const { dependencies, quit, finishWrites } = setUp({ writing: true });
    quit();
    await settle();

    expect(quit()).toBe(false);
    await settle();
    expect(dependencies.askToQuitWhenDone).toHaveBeenCalledOnce();
    finishWrites();
    await settle();
    expect(dependencies.quit).toHaveBeenCalledOnce();
  });

  it('with no window left to ask from, quits once the operation finishes', async () => {
    const { dependencies, quit, finishWrites } = setUp({ writing: true, windows: false });

    expect(quit()).toBe(false);
    await settle();
    expect(dependencies.askToQuitWhenDone).not.toHaveBeenCalled();
    finishWrites();
    await settle();
    expect(dependencies.quit).toHaveBeenCalledOnce();
  });
});
