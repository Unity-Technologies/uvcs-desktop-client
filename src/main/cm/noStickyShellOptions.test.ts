import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { STICKY_SHELL_OPTIONS } from './stickyShellOptions';

const MAIN_DIRECTORY = join(__dirname, '..');

/** A string literal starting with one of the options: what a command's arguments would hold. */
const STICKY_LITERAL = new RegExp(`['"\`](${STICKY_SHELL_OPTIONS.join('|')})\\b`);

/** The files that name them: the list itself, and the secrets the logs hide (`SECRET_OPTIONS`), which never run them. */
const ALLOWED_FILES = new Set([join('cm', 'stickyShellOptions.ts'), join('cm', 'hideSecrets.ts')]);

/**
 * A `cm shell` keeps these options for every later command of its session (`STICKY_SHELL_OPTIONS`): `CmClient` refuses
 * them in a quick command, and no source of the main process passes them at all, so none can reach a pooled shell by a
 * path the refusal doesn't see. A command that truly needs one runs with `execute()` and joins `ALLOWED_FILES` with why.
 */
describe('options that stick to a cm shell', () => {
  it('appear in no main-process source but their own list', () => {
    const offending = filesUnder(MAIN_DIRECTORY, isAppSource)
      .map((file) => relative(MAIN_DIRECTORY, file))
      .filter((file) => !ALLOWED_FILES.has(file) && STICKY_LITERAL.test(readFileSync(join(MAIN_DIRECTORY, file), 'utf8')));

    expect(offending).toEqual([]);
  });

  it('are found by the scan where they are written', () => {
    expect(STICKY_LITERAL.test("cm.query(['find', 'branch', '--username=ana'])")).toBe(true);
    expect(STICKY_LITERAL.test('const args = [`-wks=${path}`];')).toBe(true);
    expect(STICKY_LITERAL.test("cm.query(['find', 'branch', '--format={name}'])")).toBe(false);
  });
});
