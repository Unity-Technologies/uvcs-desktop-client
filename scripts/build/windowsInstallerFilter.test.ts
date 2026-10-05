import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RELEASE_WORKFLOW = join(__dirname, '..', '..', '.github', 'workflows', 'release.yml');

/** The `env:` block of the workflow step with this name, one `NAME: value` per line. */
function stepEnvironment(workflow: string, stepName: string): Record<string, string> {
  const step = workflow.split(/^\s+- name: /m).find((block) => block.split(/\r?\n/, 1)[0] === stepName);
  const env = step?.match(/^(\s+)env:\r?\n((?:\1 {2}.*\r?\n?)*)/m)?.[2] ?? '';
  return Object.fromEntries([...env.matchAll(/^\s+(\w+): (.*?)\s*$/gm)].map((match) => [match[1], match[2]]));
}

describe('Release workflow', () => {
  // electron-builder's 7-Zip packs ARM64 executables with the ARM64 filter, which the installer's own extractor
  // (nsis7z 19.00, in electron-builder's nsis-resources) can't decode: the arm64 installer would install everything but
  // the app's .exe and DLLs (docs/features/updates.md "Windows installer").
  it('packs the Windows installers with a filter their extractor can read', () => {
    expect(stepEnvironment(readFileSync(RELEASE_WORKFLOW, 'utf8'), 'Build and upload').ELECTRON_BUILDER_7Z_FILTER).toBe('BCJ');
  });
});
