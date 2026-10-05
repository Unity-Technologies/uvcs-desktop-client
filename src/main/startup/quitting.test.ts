import { describe, expect, it, vi } from 'vitest';
import { Quitting, type QuittingDependencies } from './quitting';

vi.mock('electron', async () => (await import('../window/testing/fakeElectron')).fakeElectron.module);

/** A quit with an operation running or not; the user answers `answer` when asked. */
function setUp({ writing = false, windows = true, answer = true, quitsWithLastWindow = false } = {}) {
  let finishWrites!: () => void;
  const writesFinished = new Promise<void>((resolve) => (finishWrites = resolve));
  const dependencies = {
    writesRunning: vi.fn(() => writing),
    writesFinished: vi.fn(() => writesFinished),
    askToQuitWhenDone: vi.fn(async () => answer),
    hasWindows: () => windows,
    quitsWithLastWindow,
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
    expect(dependencies.saveSession).toHaveBeenCalledExactlyOnceWith({ withViews: false });
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

describe('restarting to install an update', () => {
  it('saves the windows with their views before quitting', () => {
    const { dependencies } = setUp();

    new Quitting(dependencies).restartToInstall();
    expect(dependencies.saveSession).toHaveBeenCalledExactlyOnceWith({ withViews: true });
  });

  it("keeps the windows saved when they closed before the quit began (Squirrel.Mac), else saves them as they are", () => {
    const closedFirst = setUp({ windows: false });
    const quitting = new Quitting(closedFirst.dependencies);
    quitting.restartToInstall();
    quitting.beforeQuit({ preventDefault: () => {} });
    expect(closedFirst.dependencies.saveSession).toHaveBeenCalledOnce();

    const stillOpen = setUp();
    const restarting = new Quitting(stillOpen.dependencies);
    restarting.restartToInstall();
    restarting.beforeQuit({ preventDefault: () => {} });
    expect(stillOpen.dependencies.saveSession.mock.calls).toEqual([[{ withViews: true }], [{ withViews: true }]]);
  });
});

describe('the windows saved for the next launch', () => {
  it('are the last window, saved as it closes, where the app quits with it (Windows, Linux)', () => {
    const { dependencies } = setUp({ quitsWithLastWindow: true });
    const quitting = new Quitting(dependencies);

    quitting.lastWindowClosing();
    expect(dependencies.saveSession).toHaveBeenCalledExactlyOnceWith({ withViews: false });
    // The quit that follows finds no window: the one just saved stays.
    dependencies.hasWindows = () => false;
    quitting.beforeQuit({ preventDefault: () => {} });
    expect(dependencies.saveSession).toHaveBeenCalledOnce();
  });

  it('are none on macOS when every window was closed before quitting, and the last one closing saves nothing', () => {
    const { dependencies } = setUp({ windows: false });
    const quitting = new Quitting(dependencies);

    quitting.lastWindowClosing();
    expect(dependencies.saveSession).not.toHaveBeenCalled();
    quitting.beforeQuit({ preventDefault: () => {} });
    expect(dependencies.saveSession).toHaveBeenCalledExactlyOnceWith({ withViews: false });
  });

  it('stay as the quit saved them while its windows close, a restart’s views included', () => {
    const { dependencies } = setUp({ quitsWithLastWindow: true });
    const quitting = new Quitting(dependencies);
    quitting.restartToInstall();
    quitting.beforeQuit({ preventDefault: () => {} });

    quitting.lastWindowClosing();
    expect(dependencies.saveSession.mock.calls).toEqual([[{ withViews: true }], [{ withViews: true }]]);
  });
});
