import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/** A file's source and the sources of the app files it imports by a relative path: a list and its row components. */
function sourceWithItsImports(file: string): string {
  const source = readFileSync(file, 'utf8');
  const imported = [...source.matchAll(/from '(\.{1,2}\/[^']+)'/g)]
    .map(([, specifier]) => resolve(dirname(file), specifier!))
    .flatMap((path) => [`${path}.tsx`, `${path}.ts`].filter((candidate) => existsSync(candidate)));
  return [source, ...imported.map((path) => readFileSync(path, 'utf8'))].join('\n');
}

/** The lists whose highlighted result opens its actions from the keyboard (`isRowMenuKey`), the key's own files aside. */
const rowMenuLists = filesUnder(__dirname, isAppSource)
  .filter((file) => !['rowMenu.ts', 'RowActionsButton.tsx'].includes(basename(file)))
  .filter((file) => /\bisRowMenuKey\(/.test(readFileSync(file, 'utf8')))
  .map((file) => ({ name: basename(file), source: sourceWithItsImports(file) }));

/**
 * Every list driven from its filter offers a result's actions the same three ways: Tab (or the menu key), the "…" on
 * the highlighted row (`RowActionsButton`), and a right click on any row, which open one menu at that button.
 */
describe('lists whose results have actions', () => {
  it('include the palette, Go to file and the branch and workspace switchers', () => {
    expect(rowMenuLists.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['CommandPalette.tsx', 'GoToFileDialog.tsx', 'BranchSearchList.tsx', 'WorkspaceSwitcherRows.tsx']),
    );
  });

  it('each show the "…" and open it on a right click', () => {
    const inconsistent = rowMenuLists
      .filter(({ source }) => !/<RowActionsButton\b/.test(source) || !/\bonContextMenu=/.test(source) || /<ActionContextMenu\b/.test(source))
      .map(({ name }) => name);
    expect(inconsistent).toEqual([]);
  });
});
