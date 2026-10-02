import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

/** The @pierre/diffs version package-lock.json installs. */
function installedPierreVersion(): string {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> };
  return lock.packages['node_modules/@pierre/diffs']?.version ?? 'missing';
}

/** The @pierre/diffs version the `pierre-diffs` skill describes, recorded when it was installed. */
function skillPierreVersion(): string {
  const recorded = JSON.parse(readFileSync(join(ROOT, '.claude', 'skills', 'pierre-diffs', 'pierre-version.json'), 'utf8')) as { version: string };
  return recorded.version;
}

describe("Pierre's pierre-diffs skill", () => {
  // Agents read the skill to use Pierre's API: one describing another version sends them to APIs the app doesn't have.
  it('describes the @pierre/diffs version the app installs', () => {
    const installed = installedPierreVersion();
    expect(
      skillPierreVersion(),
      `@pierre/diffs is ${installed}: reinstall the skill for it (copy ` +
        `skills/diffs from the diffs-v${installed} tag of pierrecomputer/pierre into .claude/skills/pierre-diffs, with name: pierre-diffs in its SKILL.md), then set ` +
        `"version", "source" and "commit" in .claude/skills/pierre-diffs/pierre-version.json and re-apply its "localChanges"`,
    ).toBe(installed);
  });
});
