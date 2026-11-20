import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

/**
 * The only places a comment's chips are no links (`interactive={false}`), each for its reason
 * (docs/features/rich-comments.md "How references show"). Anywhere else a chip opens what it names.
 */
const CHIPS_NOT_LINKS: Record<string, string> = {
  'features/shelves/MyShelveRow.tsx': 'the row is clicked as a whole',
  'features/branches/BranchSearchItem.tsx': "the branch search's option is clicked as a whole",
  'features/changesets/ChangesetPickerDialog.tsx': "the picker's option is clicked as a whole",
  'features/codeReviews/rounds/CheckinsRow.tsx': "a check-in's line opens it in the review's Changes when clicked",
  'features/codeReviews/conversation/ReviewThreadCard.tsx': "a folded thread's line unfolds it when clicked",
  'components/comments/ChipHoverCard.tsx': "a chip's card shows the comment it names, the chip itself the link",
  'components/commentEditor/EditorTable.tsx': 'the editor: a click places the cursor',
  'components/commentEditor/liveWidgets.tsx': 'the editor: a click places the cursor',
};

describe("a comment's chips", () => {
  it('are links everywhere but where a click belongs to what holds them', () => {
    const turnedOff = ['features', 'components', 'app']
      .flatMap((folder) => filesUnder(join(__dirname, folder), isAppSource))
      .filter((file) => file.endsWith('.tsx') && readFileSync(file, 'utf8').includes('interactive={false}'))
      .map((file) => relative(__dirname, file).split(sep).join('/'))
      .sort();
    expect(turnedOff).toEqual(Object.keys(CHIPS_NOT_LINKS).sort());
  });

  it("wear the links' accent only when they are links: a person, never one, reads as a name", () => {
    const css = readFileSync(join(__dirname, 'components', 'comments', 'ReferenceChip.module.css'), 'utf8');
    const person = /\.person\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(person).toBeDefined();
    expect(person).not.toContain('--accent-text');
  });
});
