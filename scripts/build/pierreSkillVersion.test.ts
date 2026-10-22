import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

/** The version of a package package-lock.json installs. */
function installedVersion(packageName: string): string {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> };
  return lock.packages[`node_modules/${packageName}`]?.version ?? 'missing';
}

/** What was recorded of a skill of Pierre's when it was installed: the package version it describes, where it came from. */
function recordedSkill(skill: string): { version: string; source: string } {
  return JSON.parse(readFileSync(join(ROOT, '.claude', 'skills', skill, 'pierre-version.json'), 'utf8')) as { version: string; source: string };
}

/** How to reinstall Pierre's skills from the tag of the @pierre/diffs installed. */
function reinstall(tag: string): string {
  return (
    `reinstall Pierre's skills from the ${tag} tag of pierrecomputer/pierre ` +
    `(npx skills add https://github.com/pierrecomputer/pierre/tree/${tag}/skills --skill diffs --skill highlights ` +
    `-a claude-code --copy -y), into .claude/skills/pierre-diffs and .claude/skills/pierre-highlights, then set ` +
    `"version", "source" and "commit" in each pierre-version.json and re-apply its "localChanges"`
  );
}

// Agents read the skills to use Pierre's API: one describing another version sends them to APIs the app doesn't have.
// Both come from the same tag of pierrecomputer/pierre, the one of the @pierre/diffs installed, which pins the
// @pierre/highlights it uses.
const SKILLS = [
  { skill: 'pierre-diffs', packageName: '@pierre/diffs' },
  { skill: 'pierre-highlights', packageName: '@pierre/highlights' },
];

describe("Pierre's skills", () => {
  it.each(SKILLS)('$skill describes the $packageName version the app installs', ({ skill, packageName }) => {
    const installed = installedVersion(packageName);
    const tag = `diffs-v${installedVersion('@pierre/diffs')}`;
    expect(recordedSkill(skill).version, `${packageName} is ${installed}: ${reinstall(tag)}`).toBe(installed);
  });

  it.each(SKILLS)('$skill comes from the tag of the @pierre/diffs the app installs', ({ skill }) => {
    const tag = `diffs-v${installedVersion('@pierre/diffs')}`;
    expect(recordedSkill(skill).source, `${skill} is from another tag: ${reinstall(tag)}`).toContain(`/tree/${tag}/`);
  });
});
