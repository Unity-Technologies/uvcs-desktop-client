import { describe, expect, it } from 'vitest';
import { canRunInShell } from '../cm/shellCommandLine';
import { featureUseArgs, pingArgs } from './usageEventArgs';

describe('usage event arguments', () => {
  it('names the feature used as the other GUIs name it', () => {
    expect(featureUseArgs('checkin')).toEqual(['trackevent', 'featureuse', 'checkin']);
    expect(featureUseArgs('undo')).toEqual(['trackevent', 'featureuse', 'undo']);
  });

  it('pings with the theme, written as the other GUIs write it, and the screen size, as key=value pairs', () => {
    expect(pingArgs({ dark: true, screen: { width: 3840, height: 2160 } })).toEqual(['trackevent', 'ping', '--extrainfo=theme=Dark:screenresolution=3840x2160']);
    expect(pingArgs({ dark: false, screen: { width: 1920, height: 1080 } })).toEqual(['trackevent', 'ping', '--extrainfo=theme=Light:screenresolution=1920x1080']);
  });

  it('runs in a cm shell: no spaces or quotes to escape', () => {
    const args = [...featureUseArgs('checkin'), ...pingArgs({ dark: true, screen: { width: 1, height: 1 } })];

    expect(canRunInShell(args)).toBe(true);
    expect(args.some((arg) => /\s/.test(arg))).toBe(false);
  });
});
