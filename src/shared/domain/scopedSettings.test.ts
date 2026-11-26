import { describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '../testing/stableIdsFor';
import {
  repositorySettingsOf,
  serverSettingsOf,
  withRepositoryKeptByGuid,
  withRepositorySettings,
  withRepositorySettingsAdded,
  withServerSettings,
  withServerSettingsAdded,
} from './scopedSettings';

const pin = { branch: 7, row: 2 };
const GAME = repositoryGuidFor(1);
const ART = repositoryGuidFor(2);

describe('repository settings', () => {
  it('are kept by the repository’s GUID', () => {
    const byRepository = withRepositorySettings({}, GAME, { syncRemote: 'game@cloud' });
    expect(byRepository).toEqual({ [GAME]: { syncRemote: 'game@cloud' } });
    expect(repositorySettingsOf(byRepository, GAME)).toEqual({ syncRemote: 'game@cloud' });
  });

  it('change one value and keep the repository’s others and every other repository’s', () => {
    const before = { [GAME]: { syncRemote: 'game@cloud', branchPins: [pin] }, [ART]: { explorerRulesOff: true } };
    const after = withRepositorySettings(before, GAME, { explorerRulesOff: true });
    expect(after).toEqual({ [GAME]: { syncRemote: 'game@cloud', branchPins: [pin], explorerRulesOff: true }, [ART]: { explorerRulesOff: true } });
  });

  it('keep nothing for a value forgotten, turned back on or emptied, and drop a repository left with nothing', () => {
    const before = { [GAME]: { syncRemote: 'game@cloud', branchPins: [pin], explorerRulesOff: true } };
    expect(withRepositorySettings(before, GAME, { syncRemote: null, branchPins: [], explorerRulesOff: false })).toEqual({});
  });

  it('are the same empty object for a repository with none, or whose GUID isn’t known', () => {
    expect(repositorySettingsOf({}, GAME)).toBe(repositorySettingsOf({}, undefined));
  });

  it('read as none while they are kept by the repository’s spec', () => {
    expect(repositorySettingsOf({ 'game@host': { explorerRulesOff: true } }, GAME)).toEqual({});
  });
});

describe('repository settings kept by spec before', () => {
  it('move under the GUID, however the spec is written, and leave every other repository’s', () => {
    const before = { 'game@host:8087': { branchPins: [pin] }, [ART]: { explorerRulesOff: true } };

    expect(withRepositoryKeptByGuid(before, 'Game@ssl://Host:8087', GAME)).toEqual({ [GAME]: { branchPins: [pin] }, [ART]: { explorerRulesOff: true } });
  });

  it('give way to what the GUID keeps already', () => {
    const newer = { branch: 9, row: 1 };
    const before = { 'game@host': { branchPins: [pin], explorerRulesOff: true }, [GAME]: { branchPins: [newer] } };

    expect(withRepositoryKeptByGuid(before, 'game@host', GAME)).toEqual({ [GAME]: { branchPins: [newer], explorerRulesOff: true } });
  });

  it('change nothing when the spec kept nothing', () => {
    const before = { [GAME]: { explorerRulesOff: true } };

    expect(withRepositoryKeptByGuid(before, 'game@host', GAME)).toBe(before);
  });
});

describe('server settings', () => {
  it('are found however the server is written, and forgotten with null', () => {
    const byServer = withServerSettings({}, 'ACME@unity', { homeProject: 'Racing' });
    expect(serverSettingsOf(byServer, 'acme@unity')).toEqual({ homeProject: 'Racing' });
    expect(withServerSettings(byServer, 'acme@unity', { homeProject: null })).toEqual({});
  });
});

describe('settings added from another place', () => {
  it('fill what a repository keeps nothing of yet, under its key, and never replace what it keeps', () => {
    const kept = { 'game@host': { syncRemote: 'game@cloud' } };
    const added = { 'Game@host': { syncRemote: 'old@cloud', branchPins: [pin] }, 'art@host': { explorerRulesOff: true } };
    expect(withRepositorySettingsAdded(kept, added)).toEqual({
      'game@host': { syncRemote: 'game@cloud', branchPins: [pin] },
      'art@host': { explorerRulesOff: true },
    });
  });

  it('change nothing when added twice, and leave out what holds nothing', () => {
    const added = { 'game@host': { branchPins: [pin] }, 'empty@host': { branchPins: [] } };
    const once = withRepositorySettingsAdded({}, added);
    expect(withRepositorySettingsAdded(once, added)).toEqual({ 'game@host': { branchPins: [pin] } });
  });

  it('fill a server’s the same way', () => {
    expect(withServerSettingsAdded({ 'acme@unity': { homeProject: 'Racing' } }, { 'ACME@unity': { homeProject: 'Old' }, 'beta@unity': { homeProject: 'Kart' } })).toEqual({
      'acme@unity': { homeProject: 'Racing' },
      'beta@unity': { homeProject: 'Kart' },
    });
  });
});
