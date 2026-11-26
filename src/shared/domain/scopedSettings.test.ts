import { describe, expect, it } from 'vitest';
import {
  repositorySettingsOf,
  serverSettingsOf,
  withRepositorySettings,
  withRepositorySettingsAdded,
  withServerSettings,
  withServerSettingsAdded,
} from './scopedSettings';

const pin = { branch: 7, row: 2 };

describe('repository settings', () => {
  it('are found however the spec is written', () => {
    const byRepository = withRepositorySettings({}, 'Game@ssl://Host:8087', { syncRemote: 'game@cloud' });
    expect(byRepository).toEqual({ 'game@host:8087': { syncRemote: 'game@cloud' } });
    expect(repositorySettingsOf(byRepository, 'game@host:8087')).toEqual({ syncRemote: 'game@cloud' });
  });

  it('change one value and keep the repository’s others and every other repository’s', () => {
    const before = { 'game@host': { syncRemote: 'game@cloud', branchPins: [pin] }, 'art@host': { explorerRulesOff: true } };
    const after = withRepositorySettings(before, 'game@host', { explorerRulesOff: true });
    expect(after).toEqual({ 'game@host': { syncRemote: 'game@cloud', branchPins: [pin], explorerRulesOff: true }, 'art@host': { explorerRulesOff: true } });
  });

  it('keep nothing for a value forgotten, turned back on or emptied, and drop a repository left with nothing', () => {
    const before = { 'game@host': { syncRemote: 'game@cloud', branchPins: [pin], explorerRulesOff: true } };
    expect(withRepositorySettings(before, 'game@host', { syncRemote: null, branchPins: [], explorerRulesOff: false })).toEqual({});
  });

  it('are the same empty object for a repository with none, or none known yet', () => {
    expect(repositorySettingsOf({}, 'game@host')).toBe(repositorySettingsOf({}, undefined));
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
