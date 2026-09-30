import { describe, expect, it } from 'vitest';
import { windowIcon } from './appIcon';

const APP_ICON_PNG = /512x512\.png/;

describe('windowIcon', () => {
  it('gives Linux windows the app icon, installed or not', () => {
    expect(windowIcon('linux', true)).toMatch(APP_ICON_PNG);
    expect(windowIcon('linux', false)).toMatch(APP_ICON_PNG);
  });

  it("leaves an installed Windows app's windows to its executable's icon, which has every size from 16 pixels", () => {
    expect(windowIcon('win32', true)).toBeUndefined();
    expect(windowIcon('win32', false)).toMatch(APP_ICON_PNG);
  });

  it('gives macOS windows none: the Dock shows the app', () => {
    expect(windowIcon('darwin', true)).toBeUndefined();
    expect(windowIcon('darwin', false)).toBeUndefined();
  });
});
