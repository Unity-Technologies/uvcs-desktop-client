import { describe, expect, it } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { AppIconProgress, type IconWindows } from './AppIconProgress';
import type { ProgressBarCall } from './iconProgress';

/** Windows 1 and 2, the first focused, recording what each sets on the icon. */
function fakeWindows(ids = [1, 2]) {
  const calls: { windowId: number; call: ProgressBarCall }[] = [];
  const state = { open: [...ids], focused: 1 as number | null };
  const windows: IconWindows = {
    ids: () => state.open,
    isFocused: (windowId) => state.focused === windowId,
    setProgressBar: (windowId, call) => calls.push({ windowId, call }),
  };
  /** What the window last set, or undefined when it set nothing. */
  const last = (windowId: number) => calls.filter((entry) => entry.windowId === windowId).at(-1)?.call;
  return { windows, calls, state, last };
}

function downloading(fraction: number): OperationProgress {
  return { stage: 'downloading', stageLabel: 'Downloading', fraction };
}

/** An operation the test ends, and its signal. */
function operation() {
  const controller = new AbortController();
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const finished = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  finished.catch(() => {});
  return { finished, signal: controller.signal, finish, fail, cancel: () => controller.abort() };
}

/** Waits for the operation to settle: the icon heard it first, as it listened from the start. */
const settled = (finished: Promise<void>) => finished.catch(() => {});

describe('AppIconProgress on Windows', () => {
  it("shows each window's operation on its own taskbar button", () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();

    icon.started('update-1', 2, update.finished, update.signal);
    expect(last(2)).toEqual({ value: 1, mode: 'indeterminate' });
    expect(last(1)).toEqual({ value: -1 });

    icon.reported('update-1', downloading(0.25));
    expect(last(2)).toEqual({ value: 0.25, mode: 'normal' });
  });

  it('clears the bar when the operation ends', async () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const checkin = operation();
    icon.started('checkin-1', 1, checkin.finished, checkin.signal);

    checkin.finish();
    await settled(checkin.finished);

    expect(last(1)).toEqual({ value: -1 });
  });

  it('turns red when the operation fails in a window the user is not looking at, until they come back to it', async () => {
    const { windows, last, state } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 2, update.finished, update.signal);

    update.fail(new Error('The server is down'));
    await settled(update.finished);
    expect(last(2)).toEqual({ value: 1, mode: 'error' });

    state.focused = 2;
    icon.windowFocused(2);
    expect(last(2)).toEqual({ value: -1 });
  });

  it('shows nothing when the operation fails while the user looks at its window: the window already says so', async () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);

    update.fail(new Error('The server is down'));
    await settled(update.finished);

    expect(last(1)).toEqual({ value: -1 });
  });

  it('shows nothing when the user cancelled the operation', async () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 2, update.finished, update.signal);

    update.cancel();
    update.fail(new Error('Cancelled'));
    await settled(update.finished);

    expect(last(2)).toEqual({ value: -1 });
  });

  it('clears the red bar when the window starts another operation', async () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 2, update.finished, update.signal);
    update.fail(new Error('The server is down'));
    await settled(update.finished);

    const retry = operation();
    icon.started('update-2', 2, retry.finished, retry.signal);

    expect(last(2)).toEqual({ value: 1, mode: 'indeterminate' });
  });

  it('clears a window\'s own taskbar button as it closes, even while others show', () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));

    icon.windowClosing(1);

    expect(last(1)).toEqual({ value: -1 });
  });

  it('remembers no failure for a window already gone (a page window closed with its workspace window)', async () => {
    const { windows, last, state } = fakeWindows();
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 2, update.finished, update.signal);
    icon.windowClosing(2);
    state.open = [1];
    icon.windowClosed(2);

    update.fail(new Error('The server is down'));
    await settled(update.finished);
    state.open = [1, 2];
    icon.windowOpened();

    expect(last(2)).toEqual({ value: -1 });
  });
});

describe('AppIconProgress on the Dock and the Linux launcher', () => {
  it('shows every window’s operations together on the one icon, once they can tell how far along they are', () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const { windows, last } = fakeWindows();
      const icon = new AppIconProgress(windows, platform);
      const update = operation();
      const checkin = operation();
      icon.started('update-1', 1, update.finished, update.signal);
      icon.started('checkin-1', 2, checkin.finished, checkin.signal);
      expect(last(1)).toEqual({ value: -1 });

      icon.reported('update-1', downloading(0.6));
      icon.reported('checkin-1', downloading(0.2));

      expect(last(1)).toEqual({ value: 0.4 });
      expect(last(2)).toEqual({ value: 0.4 });
    }
  });

  it('shows nothing when an operation fails: there is no red bar', async () => {
    const { windows, last } = fakeWindows();
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 2, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));

    update.fail(new Error('The server is down'));
    await settled(update.finished);

    expect(last(1)).toEqual({ value: -1 });
    expect(last(2)).toEqual({ value: -1 });
  });

  it('clears the icon as the last window closes, since the Dock keeps a bar after its window is gone', () => {
    const { windows, last } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));

    icon.windowClosing(1);
    icon.reported('update-1', downloading(0.7));

    expect(last(1)).toEqual({ value: -1 });
  });

  it('leaves the icon to the other windows when one of them closes', () => {
    const { windows, calls } = fakeWindows();
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));
    calls.length = 0;

    icon.windowClosing(1);
    icon.reported('update-1', downloading(0.7));

    expect(calls).toEqual([{ windowId: 2, call: { value: 0.7 } }]);
  });

  it('shows the icon again when the window holds its close back for unsaved edits', () => {
    const { windows, last } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));
    icon.windowClosing(1);

    icon.windowKept(1);

    expect(last(1)).toEqual({ value: 0.5 });
  });

  it('clears the icon when a held-back close then goes ahead', () => {
    const { windows, last, state } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));
    icon.windowClosing(1);
    icon.windowKept(1);

    icon.windowClosing(1);
    icon.reported('update-1', downloading(0.7));
    state.open = [];
    icon.windowClosed(1);

    expect(last(1)).toEqual({ value: -1 });
  });

  it('clears the icon when quitting closes every window, the last to start closing doing it', () => {
    const { windows, last, calls } = fakeWindows();
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));

    icon.windowClosing(1);
    icon.windowClosing(2);
    icon.reported('update-1', downloading(0.7));

    expect(last(2)).toEqual({ value: -1 });
    expect(calls.filter((entry) => entry.call.value === 0.7)).toEqual([]);
  });

  it('shows a running operation in a window opened after its own closed', () => {
    const { windows, last, state } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));
    icon.windowClosing(1);
    state.open = [];
    icon.windowClosed(1);

    state.open = [3];
    icon.windowOpened();

    expect(last(3)).toEqual({ value: 0.5 });
  });
});

describe('AppIconProgress', () => {
  it('sets nothing for a report that changes nothing on the icon', () => {
    const { windows, calls } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'darwin');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    icon.reported('update-1', downloading(0.5));
    calls.length = 0;

    icon.reported('update-1', { ...downloading(0.5), currentItem: 'Assets/Hero.png' });

    expect(calls).toEqual([]);
  });

  it('ignores the last report of an operation already finished', async () => {
    const { windows, last } = fakeWindows([1]);
    const icon = new AppIconProgress(windows, 'win32');
    const update = operation();
    icon.started('update-1', 1, update.finished, update.signal);
    update.finish();
    await settled(update.finished);

    icon.reported('update-1', downloading(1));

    expect(last(1)).toEqual({ value: -1 });
  });
});
