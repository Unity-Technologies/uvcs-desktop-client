import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKFLOWS = join(__dirname, '..', '..', '.github', 'workflows');
const CI_WORKFLOW = join(WORKFLOWS, 'ci.yml');
const RELEASE_NOTE_WORKFLOW = join(WORKFLOWS, 'release-note.yml');

/** The events listed under the workflow's top-level `on:`, one per line (`push:`, `pull_request:`...). */
function triggers(workflow: string): string[] {
  const block = workflow.match(/^on:\r?\n((?:[ \t]+.*\r?\n|\r?\n)*)/m)?.[1] ?? '';
  return [...block.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
}

describe('CI workflow', () => {
  // main requires a merge queue (docs/features/updates.md "CI"): the queue waits for the required checks on its
  // `merge_group` commit, so without this trigger no pull request would ever merge.
  it('runs for the merge queue, pull requests and main', () => {
    expect(triggers(readFileSync(CI_WORKFLOW, 'utf8')).sort()).toEqual(['merge_group', 'pull_request', 'push']);
  });
});

describe('Release note workflow', () => {
  // A required check like CI's: the queue would wait for it on its `merge_group` commit forever without the trigger.
  // `pull_request`, never `pull_request_target`: it reads the body with a token that can't write, whoever opened it.
  it('runs for the merge queue and pull requests', () => {
    expect(triggers(readFileSync(RELEASE_NOTE_WORKFLOW, 'utf8')).sort()).toEqual(['merge_group', 'pull_request']);
  });
});
