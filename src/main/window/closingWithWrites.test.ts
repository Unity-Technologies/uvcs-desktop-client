import { describe, expect, it, vi } from 'vitest';
import { ClosingWithWrites, type ClosingWithWritesDependencies } from './closingWithWrites';

/** Window 1 closing, with an operation of its own running or not; the user answers `answer` when asked. */
function setUp({ writing = false, answer = true } = {}) {
  let quitting = false;
  /** Whether each close the app made went on, rather than held back. */
  const closesThatWent: boolean[] = [];
  let finishWrites!: () => void;
  const writesFinished = new Promise<void>((resolve) => (finishWrites = resolve));
  const dependencies = {
    quitting: vi.fn(() => quitting),
    writesRunningIn: vi.fn(() => writing),
    writesFinishedIn: vi.fn(() => writesFinished),
    askToCloseWhenDone: vi.fn(async () => answer),
    kept: vi.fn(),
    // As Electron's: the window's close goes through its listeners again.
    close: vi.fn(() => void closesThatWent.push(close())),
  } satisfies ClosingWithWritesDependencies;
  const closing = new ClosingWithWrites(dependencies);
  /** Closes window 1 as Electron does (`close`): whether the close went on. */
  const close = (): boolean => {
    let held = false;
    closing.closeRequested(1, { preventDefault: () => void (held = true) });
    return !held;
  };
  const closeLeftBehind = (): void => closing.closeLeftBehind(1);
  return { dependencies, close, closeLeftBehind, closesThatWent, setWriting: (running: boolean) => (writing = running), quit: () => (quitting = true), finishWrites: () => ((writing = false), finishWrites()) };
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

describe('closing a window the app closes itself', () => {
  it('closes it at once when none of its operations runs, asking nothing', () => {
    const { dependencies, closeLeftBehind } = setUp();

    closeLeftBehind();
    expect(dependencies.close).toHaveBeenCalledExactlyOnceWith(1);
    expect(dependencies.askToCloseWhenDone).not.toHaveBeenCalled();
  });

  it('keeps it open, asking nothing, until its operation finishes, then closes it once', async () => {
    const { dependencies, closeLeftBehind, finishWrites } = setUp({ writing: true });

    closeLeftBehind();
    closeLeftBehind();
    await settle();
    expect(dependencies.askToCloseWhenDone).not.toHaveBeenCalled();
    expect(dependencies.close).not.toHaveBeenCalled();

    finishWrites();
    await settle();
    expect(dependencies.close).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('closes a window that was asking about its own close once its operation finishes, the question still open', async () => {
    const { closesThatWent, close, closeLeftBehind, finishWrites } = setUp({ writing: true });
    close();
    closeLeftBehind();

    finishWrites();
    await settle();
    // Both the app's close and the question's close go on (the second finds the window gone).
    expect(closesThatWent).toEqual([true, true]);
  });

  it('waits again when another operation started as the last one ended, and never asks', async () => {
    const { dependencies, closesThatWent, closeLeftBehind, setWriting } = setUp({ writing: true });
    let rounds = 0;
    dependencies.writesFinishedIn.mockImplementation(async () => void setWriting(++rounds < 2));

    closeLeftBehind();
    await settle();
    expect(dependencies.writesFinishedIn).toHaveBeenCalledTimes(2);
    expect(closesThatWent).toEqual([true]);
    expect(dependencies.askToCloseWhenDone).not.toHaveBeenCalled();
  });

  it("still asks when the user closes the window while the app waits to close it, as its operation runs", async () => {
    const { dependencies, close, closeLeftBehind } = setUp({ writing: true });
    closeLeftBehind();

    expect(close()).toBe(false);
    await settle();
    expect(dependencies.askToCloseWhenDone).toHaveBeenCalledOnce();
  });
});
