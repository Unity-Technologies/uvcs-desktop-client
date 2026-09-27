import { describe, expect, it } from 'vitest';
import type { CutItem } from './cutItemsStore';
import { pasteFolderFor, planPaste, reverseMoves } from './pastePlan';

const file = (path: string, isPrivate = false): CutItem => ({ path, name: path.slice(path.lastIndexOf('/') + 1), itemType: 'file', isPrivate });
const folder = (path: string, isPrivate = false): CutItem => ({ ...file(path, isPrivate), itemType: 'directory' });
const into = (path: string, isPrivate = false) => ({ path, isPrivate });

describe('pasteFolderFor', () => {
  it('pastes into the selected folder, or the folder of the selected file', () => {
    expect(pasteFolderFor([folder('src/lib')])).toBe('src/lib');
    expect(pasteFolderFor([file('src/lib/a.ts')])).toBe('src/lib');
    expect(pasteFolderFor([file('README.md')])).toBe('');
    expect(pasteFolderFor([folder('')])).toBe('');
  });

  it('pastes among several items only when they share a folder', () => {
    expect(pasteFolderFor([file('src/a.ts'), folder('src/lib')])).toBe('src');
    expect(pasteFolderFor([file('src/a.ts'), file('docs/b.md')])).toBeNull();
  });
});

describe('planPaste', () => {
  it('moves every cut item into the folder, controlled and private alike', () => {
    const plan = planPaste([file('src/a.ts'), folder('src/lib'), file('notes.txt', true)], into('docs'), ['guide.md']);
    expect(plan).toEqual({
      kind: 'ready',
      target: 'docs',
      moves: [
        { from: 'src/a.ts', to: 'docs/a.ts', isPrivate: false },
        { from: 'src/lib', to: 'docs/lib', isPrivate: false },
        { from: 'notes.txt', to: 'docs/notes.txt', isPrivate: true },
      ],
      clashes: [],
    });
  });

  it('moves into the workspace root', () => {
    expect(planPaste([file('src/a.ts')], into(''), [])).toMatchObject({ kind: 'ready', moves: [{ from: 'src/a.ts', to: 'a.ts' }] });
  });

  it('refuses without cut items or a single folder', () => {
    expect(planPaste([], into('docs'), [])).toEqual({ kind: 'refused', reason: 'Nothing is cut' });
    expect(planPaste([file('a.ts')], null, [])).toEqual({ kind: 'refused', reason: 'Select one folder to paste into' });
  });

  it('never moves a folder into itself or a folder inside it', () => {
    expect(planPaste([folder('src')], into('src'), [])).toEqual({ kind: 'refused', reason: 'Can’t move “src” into itself' });
    expect(planPaste([file('a.ts'), folder('src')], into('src/lib/deep'), [])).toEqual({ kind: 'refused', reason: 'Can’t move “src” into a folder inside it' });
  });

  it('tells a folder apart from one whose name starts the same', () => {
    expect(planPaste([folder('src')], into('src2'), [])).toMatchObject({ kind: 'ready' });
  });

  it('leaves items already in the folder where they are, and refuses when all are', () => {
    expect(planPaste([file('docs/a.md'), file('src/b.ts')], into('docs'), ['a.md'])).toMatchObject({
      kind: 'ready',
      moves: [{ from: 'src/b.ts', to: 'docs/b.ts' }],
      clashes: [],
    });
    expect(planPaste([file('docs/a.md')], into('docs'), ['a.md'])).toEqual({ kind: 'refused', reason: 'Already in /docs' });
  });

  it('keeps controlled items out of a private folder, which cm refuses', () => {
    expect(planPaste([file('src/a.ts')], into('notes', true), [])).toEqual({ kind: 'refused', reason: '/notes is private: add it to version control first' });
    expect(planPaste([file('scratch.txt', true)], into('notes', true), [])).toMatchObject({ kind: 'ready' });
  });

  it('never replaces a name the folder has, in any case', () => {
    const plan = planPaste([file('src/Guide.md'), file('src/b.ts')], into('docs'), ['guide.md']);
    expect(plan).toMatchObject({ kind: 'ready', moves: [{ from: 'src/b.ts' }], clashes: ['Guide.md'] });
    expect(planPaste([file('src/Guide.md')], into('docs'), ['guide.md'])).toEqual({ kind: 'refused', reason: '“Guide.md” already exists in /docs' });
    expect(planPaste([file('a/x'), file('b/y')], into('docs'), ['x', 'y'])).toEqual({ kind: 'refused', reason: 'Their names are taken in /docs' });
  });

  it('moves only the first of two cut items with the same name', () => {
    expect(planPaste([file('a/x.ts'), file('b/x.ts')], into('docs'), [])).toMatchObject({ moves: [{ from: 'a/x.ts' }], clashes: ['x.ts'] });
  });
});

describe('reverseMoves', () => {
  it('puts the items back', () => {
    expect(reverseMoves([{ from: 'src/a.ts', to: 'docs/a.ts', isPrivate: true }])).toEqual([{ from: 'docs/a.ts', to: 'src/a.ts', isPrivate: true }]);
  });
});
