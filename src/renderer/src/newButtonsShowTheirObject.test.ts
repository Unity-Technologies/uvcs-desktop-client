import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * A button that creates something ("New branch", "New label") shows that thing's icon with a plus (`GitBranchPlus`,
 * `TagPlus`), so it reads at a glance as what it makes; a bare `Plus` says only "add". Where Lucide has no such icon
 * the feature draws one on its grid (`TagsPlus`). Every `<Button>` whose label starts with "New " has an icon,
 * and it isn't the bare `Plus`.
 */
function newButtonsWithoutTheirIcon(source: string): string[] {
  const offenders: string[] = [];
  for (const label of source.matchAll(/>\s*(New [^<>{}]+?)\s*<\/Button>/g)) {
    const opening = source.lastIndexOf('<Button', label.index);
    if (opening < 0) continue;
    const props = source.slice(opening, label.index);
    if (!/\bicon=\{</.test(props) || /\bicon=\{<Plus\b/.test(props)) offenders.push(label[1]);
  }
  return offenders;
}

describe('buttons that create something', () => {
  it('show what they create, with a plus', () => {
    const offenders = filesUnder(__dirname, isAppSource)
      .filter((file) => file.endsWith('.tsx'))
      .flatMap((file) => newButtonsWithoutTheirIcon(readFileSync(file, 'utf8')).map((label) => `${relative(__dirname, file)}: ${label}`));
    expect(offenders).toEqual([]);
  });

  it('are found whether their icon is missing, only a plus or without one', () => {
    const source = [
      '<Button variant="primary" icon={<GitBranchPlus size={14} />} onClick={() => open()}>\n  New branch\n</Button>',
      '<Button variant="primary" icon={<Plus size={14} />} onClick={() => open()}>\n  New label\n</Button>',
      '<Button onClick={() => open()}>New attribute</Button>',
      '<Button icon={<MessageSquare size={14} />}>New code review</Button>',
      '<Button icon={<Plus size={14} />}>Add rule</Button>',
    ].join('\n');
    expect(newButtonsWithoutTheirIcon(source)).toEqual(['New label', 'New attribute', 'New code review']);
  });
});
