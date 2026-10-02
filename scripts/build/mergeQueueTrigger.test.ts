import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CI_WORKFLOW = join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml');

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
