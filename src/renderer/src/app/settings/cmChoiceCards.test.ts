import { describe, expect, it } from 'vitest';
import { cmChoiceCards, cmChoiceNote, type CmChoiceFacts } from './cmChoiceCards';

const PINNED = '11.0.16.10659';
const INSTALLED = { path: '/usr/local/bin/cm', version: '11.0.16.10700' };
const FACTS: CmChoiceFacts = { pinnedVersion: PINNED, installed: INSTALLED, source: 'installed' };

describe('cmChoiceCards', () => {
  it('shows the installed one first, then the included one', () => {
    expect(cmChoiceCards(FACTS).map((card) => [card.choice, card.label])).toEqual([
      ['installed', 'Installed on this computer'],
      ['managed', 'Included with the app'],
    ]);
  });

  it('checks the installed one when it runs, chosen or not', () => {
    const [installed, managed] = cmChoiceCards(FACTS);
    expect(installed).toEqual({
      choice: 'installed',
      label: 'Installed on this computer',
      description: 'Version 11.0.16.10700 · /usr/local/bin/cm',
      tip: '/usr/local/bin/cm',
      disabled: false,
      selected: true,
      warning: false,
      needsUpdate: false,
    });
    expect(managed).toEqual({
      choice: 'managed',
      label: 'Included with the app',
      description: 'Version 11.0.16.10659, updated with the app',
      disabled: false,
      selected: false,
      warning: false,
      needsUpdate: false,
    });
  });

  it('checks the included one when it runs: chosen, or none is installed', () => {
    expect(cmChoiceCards({ ...FACTS, source: 'managed' }).map((card) => card.selected)).toEqual([false, true]);
    const [installed, managed] = cmChoiceCards({ ...FACTS, installed: null, source: 'managed' });
    expect(installed).toMatchObject({ description: 'Not found on this computer', disabled: true, selected: false });
    expect(managed).toMatchObject({ selected: true });
  });

  it('can’t choose an installed one older than the app needs, and names the version it needs', () => {
    const [installed, managed] = cmChoiceCards({ ...FACTS, installed: { ...INSTALLED, version: '11.0.16.9000' }, source: 'managed' });
    expect(installed).toEqual({
      choice: 'installed',
      label: 'Installed on this computer',
      description: 'Version 11.0.16.9000 · Needed: 11.0.16.10659 or later',
      tip: 'Older than this app needs. Update it to use it. /usr/local/bin/cm',
      disabled: true,
      selected: false,
      warning: true,
      needsUpdate: true,
    });
    expect(managed).toMatchObject({ selected: true });
  });

  it('can’t choose the installed one while it’s looked for', () => {
    expect(cmChoiceCards({ ...FACTS, installed: undefined })[0]).toMatchObject({ description: 'Looking…', disabled: true });
  });

  // Where it has none (Linux on Arm), `system.cmVersion` stops an older one before any window shows Settings.
  it('compares no versions, and offers no included one, where the app has none of its own', () => {
    const [installed, managed] = cmChoiceCards({ ...FACTS, pinnedVersion: null, installed: { ...INSTALLED, version: '11.0.16.9000' } });
    expect(installed).toMatchObject({ disabled: false, warning: false, needsUpdate: false });
    expect(managed).toMatchObject({ description: 'Not available on this computer', disabled: true, selected: false });
  });

  it('shows its own downloading while the installed one keeps running, and a failure to try again', () => {
    expect(cmChoiceCards({ ...FACTS, switchingToOwn: { kind: 'downloading', fraction: 0.42 } })[1]).toMatchObject({
      description: 'Downloading version 11.0.16.10659… 42%',
      disabled: true,
      selected: false,
    });
    expect(cmChoiceCards({ ...FACTS, switchingToOwn: { kind: 'downloading', fraction: null } })[1]?.description).toBe('Downloading version 11.0.16.10659…');
    expect(cmChoiceCards({ ...FACTS, switchingToOwn: { kind: 'failed', failure: 'offline', detail: 'net::ERR_INTERNET_DISCONNECTED' } })[1]).toMatchObject({
      description: 'Couldn’t download it. Choose it to try again.',
      tip: 'net::ERR_INTERNET_DISCONNECTED',
      disabled: false,
      warning: true,
    });
  });

  it('checks neither when UVCS_CM_PATH runs, and says why', () => {
    expect(cmChoiceCards({ ...FACTS, source: 'environment' }).map((card) => card.selected)).toEqual([false, false]);
    expect(cmChoiceNote('environment')).toBe('UVCS_CM_PATH is set: the app runs that one, whatever is chosen here.');
    expect(cmChoiceNote('managed')).toBeNull();
  });
});
