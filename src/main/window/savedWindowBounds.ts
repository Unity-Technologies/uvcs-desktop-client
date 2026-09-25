import { screen, type BrowserWindow } from 'electron';
import type { SettingsStore } from '../settings/SettingsStore';
import { restoreWindowBounds, type Rect } from './windowBounds';

const SAVE_DELAY_MS = 500;

/** The saved window bounds, fitted to the displays attached now; null for the default size. */
export function loadWindowBounds(settings: SettingsStore): { bounds: Rect | null; maximized: boolean } {
  const saved = settings.get().windowBounds;
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  return { bounds: restoreWindowBounds(saved, workAreas), maximized: saved?.maximized ?? false };
}

/** Saves the window's bounds while it moves or resizes (after a short pause) and when it closes. */
export function saveWindowBounds(window: BrowserWindow, settings: SettingsStore): void {
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
