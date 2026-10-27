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

  it("measures a display in physical pixels, as Windows' scaled displays have them", () => {
    expect(physicalSize({ width: 1536, height: 864 }, 1.25)).toEqual({ width: 1920, height: 1080 });
    expect(physicalSize({ width: 1707, height: 960 }, 1.5)).toEqual({ width: 2561, height: 1440 });
    expect(physicalSize({ width: 1440, height: 900 }, 2)).toEqual({ width: 2880, height: 1800 });
  });
});
