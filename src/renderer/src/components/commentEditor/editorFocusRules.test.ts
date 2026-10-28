/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const RENDERER = join(__dirname, '..', '..');
/** Where comment editors live: other editors (the diff's) have their own focus. */
const COMMENT_EDITORS = [join('components', 'commentEditor'), join('components', 'comments')];

/** Each line of the renderer's sources matching `pattern`, outside the files allowed to. */
function offenders(pattern: RegExp, allowed: readonly string[]): string[] {
  return filesUnder(RENDERER, isAppSource)
    .filter((path) => !path.endsWith('.test.ts') && !allowed.some((file) => path.endsWith(file)))
    .flatMap((path) =>
      readFileSync(path, 'utf8')
        .split('\n')
        .flatMap((line, index) => (pattern.test(line) ? [`${relative(RENDERER, path)}:${index + 1}: ${line.trim()}`] : [])),
    );
}

/**
 * The editor's focus has one truth, the DOM's (`editorFocus`): its mirror in the state once stayed behind as focus mode
 * opened, and hid the suggestions for good. These keep the rule for every change to come.
 */
describe('the comment editor’s focus', () => {
  it('is read from its mirror only by the decorations and the helpers that reconcile it', () => {
    expect(offenders(/\.field\(hasFocus\b/, [join('commentEditor', 'editorFocus.ts'), join('commentEditor', 'liveDecorations.ts')])).toEqual([]);
  });

  it('is given in code only through `focusEditor`, which reconciles the mirror with it', () => {
    const inCommentEditors = offenders(/\b(?:view|editor)\??\.focus\(\)/, [join('commentEditor', 'editorFocus.ts')]).filter((line) =>
      COMMENT_EDITORS.some((folder) => line.startsWith(folder)),
    );
    expect(inCommentEditors).toEqual([]);
  });
});
