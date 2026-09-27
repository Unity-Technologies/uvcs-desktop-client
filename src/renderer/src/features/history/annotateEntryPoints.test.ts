import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The menus' modules read the platform as they load.
vi.hoisted(() => {
  const uvcs = { platform: 'darwin', invoke: async () => ({ ok: true }), on: () => () => {} };
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const window = Object.assign(new EventTarget(), { uvcs, localStorage: storage, matchMedia: () => ({ matches: false, addEventListener: () => {} }) });
  Object.assign(globalThis, { window, localStorage: storage, document: Object.assign(new EventTarget(), { visibilityState: 'visible' }) });
});

import type { DiffEntry } from '@shared/domain/diff';
import type { ItemRevision } from '@shared/domain/history';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileResult } from '../../app/commands/objectResults';
import { navigation } from '../../app/navigation/navigationStore';
import type { Page } from '../../app/navigation/pages';
import { isSubmenu, type Action, type MenuEntry } from '../../lib/actions';
import { diffEntryMenu } from '../diff/diffEntryMenu';
import { pendingChangeMenu } from '../pendingChanges/pendingChangeMenu';
import { historyMenu } from './historyMenu';

const ws = '/ws';
const opened: Page[] = [];
beforeEach(() => {
  opened.length = 0;
  vi.spyOn(navigation, 'openPage').mockImplementation((page) => void opened.push(page));
});

function annotateEntry(menu: MenuEntry[], id = 'annotate'): Action | undefined {
  return menu.flatMap((entry) => (entry === 'separator' ? [] : isSubmenu(entry) ? entry.entries : [entry])).find((entry): entry is Action => typeof entry === 'object' && 'run' in entry && entry.id === id);
}

function annotate(menu: MenuEntry[]): Page | undefined {
  annotateEntry(menu)?.run();
  return opened.at(-1);
}

const change = (kinds: PendingChange['kinds']): PendingChange => ({ path: 'src/a.ts', kinds, itemType: 'file', size: 10, lastModified: '' });
const diffEntry: DiffEntry = { status: 'changed', path: 'src/a.ts', itemType: 'file', baseRevisionId: 39, revisionId: 40 };

describe('Annotate outside the Files view', () => {
  it("opens a pending change's history annotated at the workspace's revision", () => {
    expect(annotate(pendingChangeMenu(ws, [change(['checkedOut', 'changed'])], []))).toEqual({ kind: 'history', path: 'src/a.ts', view: 'annotate' });
  });

  it('is left out for an item with no history yet', () => {
    expect(annotateEntry(pendingChangeMenu(ws, [change(['private'])], []))).toBeUndefined();
    expect(annotateEntry(pendingChangeMenu(ws, [change(['added'])], []))).toBeUndefined();
  });

  it("opens a palette result's history annotated", () => {
    const context = { workspacePath: ws, term: '', currentBranch: '/main', loadedChangeset: 6, changelists: [], changeAt: () => undefined };
    expect(annotate(fileResult({ path: 'src/a.ts', isDirectory: false }, context).menu!())).toEqual({ kind: 'history', path: 'src/a.ts', view: 'annotate' });
  });

  it("opens a changeset diff's file on the revision the diff shows", () => {
    const review = { statusOf: () => 'unreviewed', toggle: () => {} } as never;
    expect(annotate(diffEntryMenu(ws, { kind: 'changeset', changesetId: 5 }, [diffEntry], review))).toEqual({
      kind: 'history',
      path: 'src/a.ts',
      changesetId: 5,
      select: { revisionId: 40 },
      view: 'annotate',
    });
  });

  it('annotates a history row in place, opening nothing', () => {
    const shown: ItemRevision[] = [];
    const revision = { revisionId: 40, changesetId: 5, itemType: 'file', spec: 'src/a.ts#cs:5' } as ItemRevision;
    annotateEntry(historyMenu({ workspacePath: ws, path: 'src/a.ts', annotate: (row) => shown.push(row) }, [{ kind: 'revision', revision }]), 'annotateRevision')!.run();
    expect(shown).toEqual([revision]);
    expect(opened).toEqual([]);
  });
});

describe('the Annotate page', () => {
  it('is gone: nothing opens a page of that kind', () => {
    const renderer = join(__dirname, '..', '..');
    const sources = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? sources(path) : /\.tsx?$/.test(name) ? [path] : [];
      });
    const offenders = sources(renderer).filter((path) => /kind: 'annotate'|AnnotatePage/.test(readFileSync(path, 'utf8')) && !path.endsWith('annotateEntryPoints.test.ts'));
    expect(offenders.map((path) => relative(renderer, path))).toEqual([]);
  });
});
