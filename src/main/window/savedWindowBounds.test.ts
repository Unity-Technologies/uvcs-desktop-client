import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { memorySettings } from '../settings/testing/memorySettings';
import { loadWindowBounds, keepWindowBoundsSaved } from './savedWindowBounds';

vi.mock('electron', () => ({
  screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A window the test moves around. */
class MovingWindow extends EventEmitter {
  bounds = { x: 100, y: 100, width: 1200, height: 800 };
  maximized = false;
  getNormalBounds = () => this.bounds;
  isMaximized = () => this.maximized;
  isDestroyed = () => false;
  moveTo(x: number): void {
    this.bounds = { ...this.bounds, x };
    this.emit('move');
  }
}

function watched() {
  const settings = memorySettings();
  const window = new MovingWindow();
  keepWindowBoundsSaved(window as unknown as BrowserWindow, settings);
  return { settings, window };
}

describe('keepWindowBoundsSaved', () => {
  it('saves where the window was left once it stops moving, not on every step', () => {
    const { settings, window } = watched();
    const update = vi.spyOn(settings, 'update');

    for (let x = 110; x <= 200; x += 10) {
      window.moveTo(x);
      vi.advanceTimersByTime(100);
    }
    expect(update).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(update).toHaveBeenCalledTimes(1);
    expect(settings.get().windowBounds).toEqual({ x: 200, y: 100, width: 1200, height: 800, maximized: false });
  });

  it('saves at once when the window closes, with its size before maximizing', () => {
    const { settings, window } = watched();
    window.maximized = true;
    window.emit('maximize');

    window.emit('close');
    expect(settings.get().windowBounds).toEqual({ x: 100, y: 100, width: 1200, height: 800, maximized: true });
  });
});

describe('loadWindowBounds', () => {
  it('opens the window where it was left, maximized if it was', () => {
    const settings = memorySettings({ windowBounds: { x: 200, y: 150, width: 1200, height: 800, maximized: true } });
    expect(loadWindowBounds(settings)).toEqual({ bounds: { x: 200, y: 150, width: 1200, height: 800 }, maximized: true });
  });

  it('opens at the default size the first time', () => {
    expect(loadWindowBounds(memorySettings())).toEqual({ bounds: null, maximized: false });
  });
});
