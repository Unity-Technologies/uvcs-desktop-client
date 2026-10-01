import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const GITHUB_FOLDER = join(__dirname, '..', '..', '.github');

/** Every workflow and composite action: the files whose `uses:` GitHub runs. */
function automationFiles(): string[] {
  return readdirSync(GITHUB_FOLDER, { recursive: true, encoding: 'utf8' })
    .filter((file) => /^(workflows|actions)[\\/].*\.ya?ml$/.test(file))
    .map((file) => join(GITHUB_FOLDER, file));
}

/** The actions a file uses, other than the repository's own (`./.github/actions/...`). */
function thirdPartyActions(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)]
    .map((match) => match[1])
    .filter((action) => !action.startsWith('./'));
}

describe('GitHub Actions', () => {
  it('finds the workflows', () => {
    expect(automationFiles().length).toBeGreaterThan(0);
  });

  // Unity's SSDLC (supply chain): a tag can be moved to other code, a commit can't. The tag stays in a comment.
  it('pin every action to a full commit SHA', () => {
    const unpinned = automationFiles().flatMap((file) =>
      thirdPartyActions(file)
        .filter((action) => !/@[0-9a-f]{40}$/.test(action))
        .map((action) => `${file}: ${action}`),
    );
    expect(unpinned).toEqual([]);
  });
});
