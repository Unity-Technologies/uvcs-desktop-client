import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { Tool } from '@shared/domain/tools';
import { fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import type { SettingsStore } from '../settings/SettingsStore';
import type { LaunchCommand } from '../system/apps/launchCommand';
import { serviceContext } from './testing/serviceContext';
import { createToolsService } from './toolsService';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const UPLOAD: Tool = { id: 'tool:1', name: 'Upload', program: '/opt/upload', args: ['{path}'], targets: ['item', 'branch'] };
const REVISION = { kind: 'revision', revision: { revisionId: 45, repository: 'game@local' }, fileName: 'a.cs' } as const;

/** `cm cat` writing the old version to the file it is given. */
const CAT: CmAnswer = async ({ args }) => {
  await writeFile(optionValue(args, '--file=')!, 'old version');
  return '';
};

function setUp() {
  const fake = fakeCmClient({ cat: CAT });
  const launched: LaunchCommand[] = [];
  const settings = { get: () => ({ ...DEFAULT_SETTINGS, tools: [UPLOAD] }) } as unknown as SettingsStore;
  const tools = createToolsService(serviceContext(fake.cm, { settings }), vi.fn(async (command: LaunchCommand) => void launched.push(command)));
  return { fake, launched, tools };
}

describe('toolsService', () => {
  it('saves a revision with one cm cat, as "Open this revision" does, and runs the tool on the saved file', async () => {
    const { fake, launched, tools } = setUp();
    await tools.run(workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'revision', version: REVISION, fileName: 'a.cs', repository: 'game@local' }]);

    const saved = launched[0]!.args[0]!;
    expect(fake.lines()).toEqual([`cat revid:45@game@local --file=${saved}`]);
    expect(basename(saved)).toBe('a.cs');
    expect(await readFile(saved, 'utf8')).toBe('old version');
  });

  it("keeps a revision's temp file in its own folder, whatever its name says", async () => {
    const { launched, tools } = setUp();
    await tools.run(workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'revision', version: REVISION, fileName: join('..', '..', 'evil.cs'), repository: 'game@local' }]);
    expect(basename(launched[0]!.args[0]!)).toBe('evil.cs');
    expect(basename(dirname(launched[0]!.args[0]!))).toMatch(/^uvcs-rev-/);
  });

  it('asks cm nothing for an object already at hand', async () => {
    const { fake, launched, tools } = setUp();
    await tools.run(workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'branch', name: '/main' }]);
    expect(fake.lines()).toEqual([]);
    expect(launched).toHaveLength(1);
  });
});
