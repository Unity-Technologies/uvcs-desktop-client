import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsStore } from '../settings/SettingsStore';
import { memorySettings } from '../settings/testing/memorySettings';
import { followAppTheme } from './followAppTheme';
import { fakeElectron } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);

beforeEach(() => fakeElectron.reset());

/** Settings with the theme the user picked, which the test never changes. */
const settings = (): SettingsStore => ({ ...memorySettings({ theme: 'system' }), onChanged: () => () => {} }) as unknown as SettingsStore;

describe('followAppTheme', () => {
  it('redraws the caption buttons in the new theme’s colors, as tall as the zoomed top bar (Windows)', () => {
    const window = fakeElectron.newWindow();
    window.webContents.zoomLevel = 1;
    followAppTheme(settings(), 'overlay');

    fakeElectron.nativeTheme.shouldUseDarkColors = true;
    fakeElectron.nativeTheme.emit('updated');

    expect(window.titleBarOverlay).toEqual({ color: '#00000000', symbolColor: '#e6edf3', height: 53 });
  });

  it('leaves the traffic lights to the OS’s theme (macOS)', () => {
    const window = fakeElectron.newWindow();
    followAppTheme(settings(), 'inset');

    fakeElectron.nativeTheme.emit('updated');

    expect(window.titleBarOverlay).toBeNull();
  });
});
