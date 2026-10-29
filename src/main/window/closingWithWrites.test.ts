import { describe, expect, it, vi } from 'vitest';
import { ClosingWithWrites, type ClosingWithWritesDependencies } from './closingWithWrites';

/** Window 1 closing, with an operation of its own running or not; the user answers `answer` when asked. */
function setUp({ writing = false, answer = true } = {}) {
  let quitting = false;
  let finishWrites!: () => void;
  const writesFinished = new Promise<void>((resolve) => (finishWrites = resolve));
  const dependencies = {
    quitting: vi.fn(() => quitting),
    writesRunningIn: vi.fn(() => writing),
    writesFinishedIn: vi.fn(() => writesFinished),
    askToCloseWhenDone: vi.fn(async () => answer),
    kept: vi.fn(),
    close: vi.fn(),
  } satisfies ClosingWithWritesDependencies;
  const closing = new ClosingWithWrites(dependencies);
  /** Closes window 1 as Electron does (`close`): whether the close went on. */
  const close = (): boolean => {
    let held = false;
    closing.closeRequested(1, { preventDefault: () => void (held = true) });
    return !held;
  };
  return { dependencies, close, quit: () => (quitting = true), finishWrites: () => ((writing = false), finishWrites()) };
}

/** Lets the awaited steps of the close run. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('closing a window running an operation', () => {
  it('goes on at once when none of its operations changes the workspace', () => {
    const { dependencies, close } = setUp();

    expect(close()).toBe(true);
    expect(dependencies.askToCloseWhenDone).not.toHaveBeenCalled();
    expect(dependencies.kept).not.toHaveBeenCalled();
  });

  it('keeps the window while asking, then closes it once its operation finishes', async () => {
    const { dependencies, close, finishWrites } = setUp({ writing: true });

    expect(close()).toBe(false);
    expect(dependencies.kept).toHaveBeenCalledExactlyOnceWith(1);
    await settle();
    expect(dependencies.askToCloseWhenDone).toHaveBeenCalledExactlyOnceWith(1);
    expect(dependencies.writesFinishedIn).toHaveBeenCalledExactlyOnceWith(1);
    expect(dependencies.close).not.toHaveBeenCalled();

    finishWrites();
    await settle();
    expect(dependencies.close).toHaveBeenCalledExactlyOnceWith(1);
    // The close that follows goes on.
    expect(close()).toBe(true);
  });

  it('keeps the window when the user cancels, and asks again on the next close', async () => {
    const { dependencies, close } = setUp({ writing: true, answer: false });

    expect(close()).toBe(false);
    await settle();
    expect(dependencies.writesFinishedIn).not.toHaveBeenCalled();
    expect(dependencies.close).not.toHaveBeenCalled();

    expect(close()).toBe(false);
    await settle();
    expect(dependencies.askToCloseWhenDone).toHaveBeenCalledTimes(2);
  });

  it('asks once: closing again while it asks or waits holds the close back again', async () => {
    const { dependencies, close, finishWrites } = setUp({ writing: true });
    close();

    expect(close()).toBe(false);
    await settle();
    expect(close()).toBe(false);
    expect(dependencies.askToCloseWhenDone).toHaveBeenCalledOnce();

    finishWrites();
    await settle();
    expect(dependencies.close).toHaveBeenCalledOnce();
  });

  it('holds nothing once the app is quitting: its windows close with it, and quitting waited for the operations', () => {
    const { dependencies, close, quit } = setUp({ writing: true });
    quit();

    expect(close()).toBe(true);
    expect(dependencies.askToCloseWhenDone).not.toHaveBeenCalled();
    expect(dependencies.kept).not.toHaveBeenCalled();
  });

  it('lets a window that was asking when the quit began close with it, then closes again when its operation settles', async () => {
    const { dependencies, close, quit, finishWrites } = setUp({ writing: true });
    close();
    await settle();

    quit();
    expect(close()).toBe(true);
    finishWrites();
    await settle();
    // Closing a window already closing is Electron's no-op.
    expect(dependencies.close).toHaveBeenCalledExactlyOnceWith(1);
  });
});
