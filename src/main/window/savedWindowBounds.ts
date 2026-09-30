import { screen, type BrowserWindow } from 'electron';
import type { SettingsStore } from '../settings/SettingsStore';
import { cascadeWindowBounds, restoreWindowBounds, type Rect } from './windowBounds';

const SAVE_DELAY_MS = 500;

/** Where a window opens; null bounds for the default size. */
interface OpeningBounds {
  bounds: Rect | null;
  maximized: boolean;
}

/** The saved window bounds, fitted to the displays attached now. */
export function loadWindowBounds(settings: SettingsStore): OpeningBounds {
  const saved = settings.get().windowBounds;
  return { bounds: restoreWindowBounds(saved, displayWorkAreas()), maximized: saved?.maximized ?? false };
}

/** Bounds for a new window opened from `window`: offset from it, fitted to the displays. */
export function cascadedWindowBounds(window: BrowserWindow): OpeningBounds {
  return { bounds: cascadeWindowBounds(window.getNormalBounds(), displayWorkAreas()), maximized: false };
}

/** What each display attached now leaves to windows (without the menu bar, Dock or taskbar). */
function displayWorkAreas(): Rect[] {
  return screen.getAllDisplays().map((display) => display.workArea);
}

/** Saves the window's bounds while it moves or resizes (after a short pause) and when it closes. */
export function keepWindowBoundsSaved(window: BrowserWindow, settings: SettingsStore): void {
  const save = (): void => {
    if (window.isDestroyed()) return;
    // The normal bounds are the unmaximized ones, so unmaximizing after a restart goes back to where the user left it.
    settings.update({ windowBounds: { ...window.getNormalBounds(), maximized: window.isMaximized() } });
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const saveSoon = (): void => {
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };

  window.on('move', saveSoon);
  window.on('resize', saveSoon);
  window.on('maximize', saveSoon);
  window.on('unmaximize', saveSoon);
  window.on('close', () => {
    clearTimeout(timer);
    save();
  });
}
