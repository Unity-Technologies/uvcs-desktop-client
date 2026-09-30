import { describe, expect, it } from 'vitest';
import { aboutDetails } from './aboutDetails';

const INFO = { version: '1.4.0', platform: 'win32', arch: 'x64', electron: '38.1.0', chromium: '140.0.7339.80' };

describe('aboutDetails', () => {
  it('lists the version and what the app runs on, one line each, ready for an issue', () => {
    expect(aboutDetails(INFO, '11.0.16.9412').split('\n')).toEqual([
      'Unity Version Control: 1.4.0',
      'cm: 11.0.16.9412',
      'Platform: Windows · x64',
      'Electron: 38.1.0',
      'Chromium: 140.0.7339.80',
    ]);
  });

  it("says the cm version is unknown while it hasn't answered", () => {
    expect(aboutDetails(INFO, undefined)).toContain('cm: unknown');
  });
});
