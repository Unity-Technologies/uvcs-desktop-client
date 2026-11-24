import { describe, expect, it } from 'vitest';
import { cmChoiceCards, cmChoiceNote, type CmChoiceFacts } from './cmChoiceCards';

const PINNED = '11.0.16.10659';
const INSTALLED = { path: '/usr/local/bin/cm', version: '11.0.16.10700' };
const TIP = 'The version installed on this computer, or the one included with the app when none is installed.';
const FACTS: CmChoiceFacts = { choice: 'automatic', pinnedVersion: PINNED, installed: INSTALLED, source: 'installed' };

describe('cmChoiceCards', () => {
  it('checks Automatic by default, saying it runs the installed one', () => {
    const [automatic, managed] = cmChoiceCards(FACTS);
    expect(automatic).toEqual({
      choice: 'automatic',
      label: 'Automatic',
      description: 'Installed: 11.0.16.10700',
      tip: `${TIP} /usr/local/bin/cm`,
      disabled: false,
      selected: true,
      warning: false,
    });
    expect(managed).toEqual({ choice: 'managed', label: 'Included with the app', description: 'Included: 11.0.16.10659 · Updated with the app', disabled: false, selected: false, warning: false });
  });

  it('says Automatic runs the included one when none is installed', () => {
    expect(cmChoiceCards({ ...FACTS, installed: null, source: 'managed' })[0]).toMatchObject({ description: 'Included: 11.0.16.10659 · None installed', selected: true, warning: false });
  });

  it('warns that an installed one older than the app needs an update, and still lets Automatic be chosen', () => {
    const [automatic] = cmChoiceCards({ ...FACTS, choice: 'managed', installed: { ...INSTALLED, version: '11.0.16.9000' }, source: 'managed' });
    expect(automatic).toMatchObject({
      description: 'Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later',
      tip: 'The installed version needs an update. Until then, the one included with the app runs. /usr/local/bin/cm',
      disabled: false,
      selected: false,
      warning: true,
    });
  });

  it('checks the included one when it was chosen', () => {
    expect(cmChoiceCards({ ...FACTS, choice: 'managed', source: 'managed' }).map((card) => card.selected)).toEqual([false, true]);
  });

  it('says Automatic is looking while the installed one is looked for', () => {
    expect(cmChoiceCards({ ...FACTS, installed: undefined })[0]).toMatchObject({ description: 'Looking…', disabled: false });
  });

  // Where it has none (Linux on Arm), `system.cmVersion` stops an older one before any window shows Settings.
  it('compares no versions, and offers no included one, where the app has none of its own', () => {
    const [automatic, managed] = cmChoiceCards({ ...FACTS, pinnedVersion: null, installed: { ...INSTALLED, version: '11.0.16.9000' } });
    expect(automatic).toMatchObject({ description: 'Installed: 11.0.16.9000', warning: false });
    expect(managed).toMatchObject({ description: 'Not available on this computer', disabled: true, selected: false });
    expect(cmChoiceCards({ ...FACTS, pinnedVersion: null, installed: null })[0]).toMatchObject({ description: 'Not found on this computer', warning: true });
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
