import { describe, expect, it } from 'vitest';
import { cmUpdateViewOf, type CmTooOld } from './cmUpdateView';

const TOO_OLD: CmTooOld = { kind: 'installedTooOld', installed: { path: '/usr/local/bin/cm', version: '11.0.16.9000' }, requiredVersion: '11.0.16.10659' };

describe('cmUpdateViewOf', () => {
  it('asks to update it in plain words, with the versions only under Details', () => {
    const view = cmUpdateViewOf(TOO_OLD, 'none');
    expect(view).toMatchObject({ title: 'Update Unity Version Control', checkAgainLabel: 'Check Again', checking: false, includedLabel: 'Use the included version for now' });
    expect(view.detail).toBe('Installed: version 11.0.16.9000 (/usr/local/bin/cm)\nNeeded: version 11.0.16.10659 or later');
    for (const text of [view.title, view.body, view.hint, view.includedLabel]) {
      expect(text).not.toMatch(/\bcm\b|command line|installer|bundle|\d+\.\d+/i);
    }
  });

  it('says it’s checking while Check Again reads the version', () => {
    expect(cmUpdateViewOf(TOO_OLD, 'checking')).toMatchObject({ checkAgainLabel: 'Checking…', checking: true });
  });

  it('says it still needs an update when Check Again found the same old version', () => {
    expect(cmUpdateViewOf(TOO_OLD, 'stillTooOld').hint).toBe('It still needs an update. Update it, then check again.');
  });
});
