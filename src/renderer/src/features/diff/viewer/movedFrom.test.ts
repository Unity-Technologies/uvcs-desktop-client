import { describe, expect, it } from 'vitest';
import { movedFrom, movedTitleMarks } from './movedFrom';

describe('movedFrom', () => {
  it('names only the old name of a file renamed in its folder', () => {
    expect(movedFrom('src/renamed.ts', 'src/torename.ts')).toBe('torename.ts');
    expect(movedFrom('renamed.ts', 'old.ts')).toBe('old.ts');
  });

  it('names the old path of a file moved to another folder', () => {
    expect(movedFrom('lib/tomove.ts', 'src/tomove.ts')).toBe('src/tomove.ts');
    expect(movedFrom('src/deeper/app.ts', 'src/app.ts')).toBe('src/app.ts');
    expect(movedFrom('app.ts', 'src/app.ts')).toBe('src/app.ts');
  });
});

describe('movedTitleMarks', () => {
  const marked = (text: string, positions: number[]): string => positions.map((position) => text[position]).join('');

  it('marks the new name in the path and the old one in a rename', () => {
    const marks = movedTitleMarks('src/Panel.cs', 'src/Drawing.cs');
    expect(marked('src/Panel.cs', marks.path)).toBe('Panel.cs');
    expect(marked(movedFrom('src/Panel.cs', 'src/Drawing.cs'), marks.from)).toBe('Drawing.cs');
  });

  it('marks the folders a move between folders changed, in both paths', () => {
    const marks = movedTitleMarks('a/lib/x.ts', 'a/src/x.ts');
    expect(marked('a/lib/x.ts', marks.path)).toBe('lib/');
    expect(marked('a/src/x.ts', marks.from)).toBe('src/');
  });

  it('marks only the folder a move into a deeper one added', () => {
    expect(movedTitleMarks('src/deeper/app.ts', 'src/app.ts')).toEqual({ path: [4, 5, 6, 7, 8, 9, 10], from: [] });
  });

  it('marks only what a move out of a folder removed', () => {
    expect(movedTitleMarks('app.ts', 'src/app.ts')).toEqual({ path: [], from: [0, 1, 2, 3] });
  });

  it('marks both whole paths when they share no folder', () => {
    expect(movedTitleMarks('b/y.ts', 'a/x.ts')).toEqual({ path: [0, 1, 2, 3, 4, 5], from: [0, 1, 2, 3, 4, 5] });
  });

  it('marks the names of a rename at the top of the workspace or under the root', () => {
    expect(movedTitleMarks('b.ts', 'a.ts')).toEqual({ path: [0, 1, 2, 3], from: [0, 1, 2, 3] });
    expect(movedTitleMarks('/b.ts', '/a.ts')).toEqual({ path: [1, 2, 3, 4], from: [0, 1, 2, 3] });
    expect(movedTitleMarks('/root/b.ts', '/root/a.ts')).toEqual({ path: [6, 7, 8, 9], from: [0, 1, 2, 3] });
  });

  it('marks the old name when the shared folder is spelled in another Unicode form in each path', () => {
    const oldPath = 'Café/x.ts';
    const path = 'Café/y.ts';
    const marks = movedTitleMarks(path, oldPath);
    expect(marked(path, marks.path)).toBe('y.ts');
    expect(marked(movedFrom(path, oldPath), marks.from)).toBe('x.ts');
  });
});
