import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CI_WORKFLOW = join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml');
const GATE_JOB = 'ci-result';

/** The ids of the workflow's jobs: the keys two spaces in under its top-level `jobs:`. */
function jobIds(workflow: string): string[] {
  const block = workflow.slice(workflow.search(/^jobs:/m));
  return [...block.matchAll(/^ {2}([\w-]+):\s*$/gm)].map((match) => match[1]);
}

/** The jobs one job waits for, as its `needs: [a, b]` lists them. */
function needsOf(workflow: string, jobId: string): string[] {
  const job = workflow.slice(workflow.search(new RegExp(`^ {2}${jobId}:`, 'm')));
  const list = job.match(/^ {4}needs:\s*\[([^\]]*)\]/m)?.[1] ?? '';
  return list.split(',').map((need) => need.trim()).filter(Boolean);
}

// Branch protection requires the gate's check alone, by its name (docs/features/updates.md "CI"): a job it doesn't wait
// for could fail and the merge queue would merge anyway.
describe('CI result gate', () => {
  it('waits for every other job of the CI workflow', () => {
    const workflow = readFileSync(CI_WORKFLOW, 'utf8');
    const others = jobIds(workflow).filter((id) => id !== GATE_JOB);
    expect(needsOf(workflow, GATE_JOB).sort()).toEqual(others.sort());
  });

  // A skipped job counts as passed for a required check: without `if: always()`, a failed job would skip the gate.
  it('runs whatever the jobs it waits for did', () => {
    const workflow = readFileSync(CI_WORKFLOW, 'utf8');
    const gate = workflow.slice(workflow.search(new RegExp(`^ {2}${GATE_JOB}:`, 'm')));
    expect(gate).toMatch(/^ {4}if: always\(\)/m);
  });
});
