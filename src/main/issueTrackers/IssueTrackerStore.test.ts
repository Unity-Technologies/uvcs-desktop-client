import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IssueTrackerStore } from './IssueTrackerStore';

function folder(): string {
  return mkdtempSync(join(tmpdir(), 'trackers-'));
}

describe('IssueTrackerStore', () => {
  const connection = { id: 'c1', kind: 'github' as const, server: 'https://github.com', scope: '*', account: { id: 'ana', name: 'Ana' }, signInMethod: 'token' as const, access: 'read' as const };

  it('keeps connections and bindings, one tracker per repository', () => {
    const path = join(folder(), 'issue-trackers.json');
    const store = new IssueTrackerStore(path);
    store.saveConnection(connection);
    store.bind({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/game'] });
    store.bind({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/tools'] });
    const again = new IssueTrackerStore(path);
    expect(again.connections()).toEqual([connection]);
    expect(again.bindings()).toEqual([{ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/tools'] }]);
  });

  it('removes a connection’s bindings with it, and moves a binding with its repository’s rename', () => {
    const store = new IssueTrackerStore(join(folder(), 'issue-trackers.json'));
    store.saveConnection(connection);
    store.bind({ repository: 'game@acme@unity', connectionId: 'c1', projects: ['acme/game'] });
    store.renameRepository('game@acme@unity', 'racer@acme@unity');
    expect(store.bindings().map((binding) => binding.repository)).toEqual(['racer@acme@unity']);
    store.removeConnection('c1');
    expect(store.bindings()).toEqual([]);
  });

  it('starts empty from a file it can’t read', () => {
    expect(new IssueTrackerStore(join(folder(), 'none.json')).connections()).toEqual([]);
  });
});
