import { describe, expect, it } from 'vitest';
import { canRunInShell } from '../cm/shellCommandLine';
import { featureUseArgs, physicalSize, pingArgs } from './usageEventArgs';

describe('usage event arguments', () => {
  it('names the feature used as the other GUIs name it', () => {
    expect(featureUseArgs('checkin')).toEqual(['trackevent', 'featureuse', 'checkin']);
    expect(featureUseArgs('undo')).toEqual(['trackevent', 'featureuse', 'undo']);
  });

  it('pings with the screen size and the theme, written as the other GUIs write them, as key=value pairs', () => {
    expect(pingArgs({ dark: true, screen: { width: 3840, height: 2160 } })).toEqual(['trackevent', 'ping', '--extrainfo=screenresolution=3840x2160:theme=Dark']);
    expect(pingArgs({ dark: false, screen: { width: 1920, height: 1080 } })).toEqual(['trackevent', 'ping', '--extrainfo=screenresolution=1920x1080:theme=Light']);
  });

  it('runs in a cm shell, where it must (CmRunOptions.inPooledShell)', () => {
    expect(canRunInShell([...featureUseArgs('checkin'), ...pingArgs({ dark: true, screen: { width: 1, height: 1 } })])).toBe(true);
  });

  it('measures a display in physical pixels on macOS and Linux from its size and whole scale factor', () => {
    const unused = () => ({ width: 0, height: 0 });
    expect(physicalSize('darwin', { size: { width: 1440, height: 900 }, scaleFactor: 2 }, unused)).toEqual({ width: 2880, height: 1800 });
    expect(physicalSize('linux', { size: { width: 1920, height: 1080 }, scaleFactor: 1 }, unused)).toEqual({ width: 1920, height: 1080 });
  });

  it("measures a Windows display as Electron converts it, since its rounded size times 1.5 lands a pixel off", () => {
    const display = { size: { width: 1707, height: 960 }, scaleFactor: 1.5 };

    expect(physicalSize('win32', display, () => ({ width: 2560, height: 1440 }))).toEqual({ width: 2560, height: 1440 });
  });
});
