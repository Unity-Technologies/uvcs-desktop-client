import { describe, expect, it } from 'vitest';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { XlinkTarget } from '@shared/domain/explorer';
import { filesUnder, xlinkDiffView } from './xlinkDiffView';

const entry = (path: string, overrides: Partial<DiffEntry> = {}): DiffEntry => ({
  status: 'changed',
  path,
  itemType: 'file',
  baseRevisionId: 1,
  revisionId: 2,
  repository: 'codice@cloud',
  ...overrides,
});

const XLINK = entry('plugins/unity-plugin', { itemType: 'xlink', baseRevisionId: -1, revisionId: -1 });

const unityGUI = (changeset: number, overrides: Partial<XlinkTarget> = {}): XlinkTarget => ({
  writable: true,
  path: '/',
  changeset,
  repository: 'unityGUI',
  server: 'codice@cloud',
  ...overrides,
});

const BRANCH: DiffTarget = { kind: 'branch', branch: '/main/task1' };

describe('A changed xlink in a diff', () => {
  it("shows a branch's xlink where the branch started and at its head", () => {
    const view = xlinkDiffView(BRANCH, XLINK, { before: unityGUI(17309), after: unityGUI(17361) }, [XLINK]);

    expect(view).toMatchObject({ kind: 'Writable xlink', target: { repository: 'unityGUI@codice@cloud', note: null } });
    expect(view.target?.sides).toEqual([
      { label: 'Where the branch started', changeset: 'cs:17309', repository: null },
      { label: 'Branch head', changeset: 'cs:17361', repository: null },
    ]);
  });

  it('names the sides of a changeset before and after, and of a range by its points', () => {
    const sides = { before: unityGUI(1), after: unityGUI(2) };
    expect(xlinkDiffView({ kind: 'changeset', changesetId: 37 }, XLINK, sides, []).target?.sides.map((side) => side.label)).toEqual(['Before', 'After']);
    expect(xlinkDiffView({ kind: 'range', fromSpec: 'cs:10', toSpec: 'lb:v1' }, XLINK, sides, []).target?.sides.map((side) => side.label)).toEqual(['cs:10', 'lb:v1']);
  });

  it('shows the one side an added or deleted xlink is on', () => {
    const added = xlinkDiffView(BRANCH, { ...XLINK, status: 'added' }, { before: null, after: unityGUI(5, { writable: false }) }, []);
    expect(added).toMatchObject({ kind: 'Read-only xlink', target: { sides: [{ label: 'Branch head', changeset: 'cs:5' }], note: null } });

    const deleted = xlinkDiffView(BRANCH, { ...XLINK, status: 'deleted' }, { before: unityGUI(4), after: null }, []);
    expect(deleted.target?.sides).toEqual([{ label: 'Where the branch started', changeset: 'cs:4', repository: null }]);
  });

  it('names a side of another repository, and the folder of it an xlink shows', () => {
    const view = xlinkDiffView(BRANCH, XLINK, { before: unityGUI(3), after: unityGUI(7, { repository: 'plugins', path: '/src' }) }, []);

    expect(view.target?.repository).toBe('plugins@codice@cloud /src');
    expect(view.target?.sides[0]).toEqual({ label: 'Where the branch started', changeset: 'cs:3', repository: 'unityGUI@codice@cloud' });
    expect(view.target?.sides[1]?.repository).toBeNull();
  });

  it('says what changed when the target did not: writable, or its other settings', () => {
    expect(xlinkDiffView(BRANCH, XLINK, { before: unityGUI(3, { writable: false }), after: unityGUI(3) }, []).target?.note).toBe('It became writable.');
    expect(xlinkDiffView(BRANCH, XLINK, { before: unityGUI(3), after: unityGUI(3) }, []).target?.note).toBe('It points to the same changeset; its settings changed.');
  });

  it("says why no side shows: a shelve's, or a point whose tree can't be read", () => {
    const none = { before: null, after: null };
    expect(xlinkDiffView({ kind: 'shelve', shelveId: 3 }, XLINK, none, [])).toMatchObject({
      kind: 'Xlink',
      target: { repository: null, sides: [], note: "Where it points can't be read for a shelve." },
    });
    expect(xlinkDiffView({ kind: 'range', fromSpec: 'lb:a', toSpec: 'lb:b' }, XLINK, none, []).target?.note).toBe("Where it points can't be read here.");
  });

  it('lists the files under it while where it points is read', () => {
    const file = entry('plugins/unity-plugin/a.cs');
    expect(xlinkDiffView(BRANCH, XLINK, undefined, [file])).toEqual({ kind: 'Xlink', target: null, files: [file], filesTitle: '1 file changed under it' });
  });
});

describe('The files changed under an xlink', () => {
  it('are the diff files inside its folder, not its own folders nor a sibling sharing its name', () => {
    const inside = entry('plugins/unity-plugin/Editor/Window.cs', { repository: 'unityGUI@codice@cloud' });
    const folder = entry('plugins/unity-plugin/Editor', { itemType: 'directory' });
    const sibling = entry('plugins/unity-plugin-tests/Test.cs');

    expect(filesUnder([XLINK, inside, folder, sibling], XLINK.path)).toEqual([inside]);
  });

  it('are counted in the title', () => {
    const files = [entry('plugins/unity-plugin/a.cs'), entry('plugins/unity-plugin/b.cs')];
    expect(xlinkDiffView(BRANCH, XLINK, { before: null, after: null }, files).filesTitle).toBe('2 files changed under it');
    expect(xlinkDiffView(BRANCH, XLINK, { before: null, after: null }, []).filesTitle).toBe('Files changed under it');
  });
});
