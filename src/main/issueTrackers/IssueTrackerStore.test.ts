import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { IssueTrackerStore } from './IssueTrackerStore';

function folder(): string {
  return mkdtempSync(join(tmpdir(), 'trackers-'));
}

const GAME = repositoryGuidFor(1);
const TOOLS = repositoryGuidFor(2);

describe('IssueTrackerStore', () => {
  const connection = { id: 'c1', kind: 'github' as const, server: 'https://github.com', scope: '*', account: { id: 'ana', name: 'Ana' }, signInMethod: 'token' as const, access: 'read' as const };

  it('keeps connections and bindings, one tracker per repository', () => {
    const path = join(folder(), 'issue-trackers.json');
    const store = new IssueTrackerStore(path);
    store.saveConnection(connection);
    store.bind({ repository: GAME, connectionId: 'c1', projects: ['acme/game'] });
    store.bind({ repository: GAME, connectionId: 'c1', projects: ['acme/tools'] });
    const again = new IssueTrackerStore(path);
    expect(again.connections()).toEqual([connection]);
    expect(again.bindings()).toEqual([{ repository: GAME, connectionId: 'c1', projects: ['acme/tools'] }]);
  });

  it('removes a connection’s bindings with it', () => {
    const store = new IssueTrackerStore(join(folder(), 'issue-trackers.json'));
    store.saveConnection(connection);
    store.bind({ repository: GAME, connectionId: 'c1', projects: ['acme/game'] });
    store.removeConnection('c1');
    expect(store.bindings()).toEqual([]);
  });

  it('moves a binding kept by the repository’s spec, however written, to its GUID once known, and keeps it there', () => {
    const path = join(folder(), 'issue-trackers.json');
    writeFileSync(path, JSON.stringify({ connections: [connection], bindings: [{ repository: 'game@ssl://ACME:8088', connectionId: 'c1', projects: ['acme/game'] }] }));
    const store = new IssueTrackerStore(path);

    expect(store.keepRepositoryByGuid('Game@acme:8088', GAME)).toBe(true);
    expect(new IssueTrackerStore(path).bindings()).toEqual([{ repository: GAME, connectionId: 'c1', projects: ['acme/game'] }]);
    expect(store.keepRepositoryByGuid('game@acme:8088', GAME)).toBe(false);
  });

  it('drops a binding kept by spec when the GUID has one of its own, and leaves every other repository’s', () => {
    const path = join(folder(), 'issue-trackers.json');
    writeFileSync(path, JSON.stringify({ connections: [connection], bindings: [{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/old'] }] }));
    const store = new IssueTrackerStore(path);
    store.bind({ repository: GAME, connectionId: 'c1', projects: ['acme/game'] });
    store.bind({ repository: TOOLS, connectionId: 'c1', projects: ['acme/tools'] });

    store.keepRepositoryByGuid('game@acme@unity', GAME);

    expect(store.bindings().map((binding) => binding.projects)).toEqual([['acme/game'], ['acme/tools']]);
    expect(store.bindingsKeptBySpec()).toEqual([]);
  });

  it('holds a binding still kept by spec apart from those kept by GUID, until its GUID is known', () => {
    const path = join(folder(), 'issue-trackers.json');
    writeFileSync(path, JSON.stringify({ connections: [connection], bindings: [{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/old'] }, { repository: TOOLS, connectionId: 'c1', projects: ['acme/tools'] }] }));
    const store = new IssueTrackerStore(path);

    expect(store.bindings()).toEqual([{ repository: TOOLS, connectionId: 'c1', projects: ['acme/tools'] }]);
    expect(store.bindingsKeptBySpec()).toEqual([{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/old'] }]);
  });

  it('starts empty from a file it can’t read', () => {
    expect(new IssueTrackerStore(join(folder(), 'none.json')).connections()).toEqual([]);
  });
});
