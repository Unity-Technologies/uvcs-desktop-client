import { describe, expect, it } from 'vitest';
import { appBundleOf } from './appBundle';

describe('appBundleOf', () => {
  it('finds the app a program is in', () => {
    expect(appBundleOf('/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code')).toBe('/Applications/Visual Studio Code.app');
    expect(appBundleOf('/usr/bin/opendiff')).toBeNull();
  });
});
