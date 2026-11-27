import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * Every view's header (`ViewHeader`) holds its buttons at one height, so the headers read as one design: "New branch"
 * in Branches stands as tall as "New merge request" in Merge requests. Header buttons take `Button`'s own size, so
 * two things keep them even:
 *
 * - a design-system control built on `Button` (`SplitButton`, `IconButton`, the chips) defaults to `Button`'s
 *   `medium`, never a size of its own; a place that wants a smaller one says `size="small"`;
 * - the buttons written in a header's `actions` set no `size`.
 */
const BUTTON_DEFAULT_SIZE = 'medium';

/** The `size` defaults a component's props set, other than `Button`'s own. */
function sizeDefaultsOtherThanButtons(source: string): string[] {
  return [...source.matchAll(/\bsize = '(\w+)'/g)].map((match) => match[1]).filter((size) => size !== BUTTON_DEFAULT_SIZE);
}

/** The `size="…"` props written inside a `<ViewHeader>`'s `actions={…}`. */
function sizesInHeaderActions(source: string): string[] {
  const sizes: string[] = [];
  for (const header of source.matchAll(/<ViewHeader\b/g)) {
    const start = source.indexOf('actions={', header.index);
    const end = source.indexOf('<ViewHeader', header.index + 1);
    if (start < 0 || (end >= 0 && start > end)) continue;
    const actions = bracedFrom(source, start + 'actions='.length);
    for (const size of actions.matchAll(/\bsize="(\w+)"/g)) sizes.push(size[1]);
  }
  return sizes;
}

/** The text of the `{…}` block that opens at `open`, braces nested inside it included. */
function bracedFrom(source: string, open: number): string {
  let depth = 0;
  for (let at = open; at < source.length; at++) {
    if (source[at] === '{') depth++;
    if (source[at] === '}' && --depth === 0) return source.slice(open, at + 1);
  }
  return source.slice(open);
}

const appTsx = () => filesUnder(__dirname, isAppSource).filter((file) => file.endsWith('.tsx'));

describe('the buttons in a view header', () => {
  it('take Button’s size from every design-system control built on it', () => {
    const offenders = appTsx()
      .filter((file) => relative(join(__dirname, 'ui'), file).split(/[\\/]/)[0] !== '..')
      .flatMap((file) => sizeDefaultsOtherThanButtons(readFileSync(file, 'utf8')).map((size) => `${relative(__dirname, file)}: ${size}`));
    expect(offenders).toEqual([]);
  });

  it('set no size of their own', () => {
    const offenders = appTsx().flatMap((file) =>
      sizesInHeaderActions(readFileSync(file, 'utf8')).map((size) => `${relative(__dirname, file)}: ${size}`),
    );
    expect(offenders).toEqual([]);
  });

  it('find a size default other than medium', () => {
    const source = [
      "export function SplitButton({ variant = 'secondary', size = 'small', icon }: Props) {",
      "export function ToggleChip({ pressed, size = 'medium', children }: Props) {",
    ].join('\n');
    expect(sizeDefaultsOtherThanButtons(source)).toEqual(['small']);
  });

  it('find a size set in a header’s actions, and not one outside them', () => {
    const source = [
      '<ViewHeader title="Branches" actions={',
      '  <>',
      '    <IconButton icon={<RefreshCw size={14} />} label="Refresh" onClick={() => refresh()} />',
      '    <SplitButton size="small" menu={[]} menuLabel="More" onClick={() => open()}>New merge request</SplitButton>',
      '  </>',
      '} />',
      '<Button size="small">Elsewhere</Button>',
      '<ViewHeader title="Labels" actions={<Button size="large">New label</Button>} />',
    ].join('\n');
    expect(sizesInHeaderActions(source)).toEqual(['small', 'large']);
  });
});
