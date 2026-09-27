import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@shared/domain/settings';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import type { LeftChangesFinder } from './leftChanges';
import { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly } from './switchShelves';
import { switchWithChanges, type SwitchDependencies } from './switchWithChanges';

vi.mock('./switchShelves', () => ({
  createSwitchShelve: vi.fn(async () => ({ id: 7, repository: 'eco@local' })),
  applyShelveCleanly: vi.fn(async () => ({ kind: 'applied' })),
}));

const header = (branch: string, changeset: number): string => `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>eco</Name></RepSpec><Changeset>${changeset}</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>${branch}@eco@local</WkConfigName>
</StatusOutput>`;

const change = (type: string, path: string): string =>
  `<Change><Type>${type}</Type><Path>${path}</Path><OldPath /><MergesInfo /><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>`;

const withChanges = (...changes: string[]): string =>
  `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus><Changes>${changes.join('')}</Changes></StatusOutput>`;

const TASK1_BRANCH = `<?xml version="1.0" encoding="utf-8" ?><PLASTICQUERY><BRANCH><ID>37</ID><COMMENT></COMMENT><DATE>2026-09-25T23:16:33+02:00</DATE><OWNER>me</OWNER><NAME>/main/task1</NAME><PARENT>/main</PARENT><REPOSITORY>eco</REPOSITORY><REPNAME>eco</REPNAME><REPSERVER>local</REPSERVER><TYPE>T</TYPE><CHANGESET>1</CHANGESET><GUID>9b8e2f7a-58f3-4c43-9d83-3c2f1f5c1a10</GUID></BRANCH></PLASTICQUERY>`;

interface Scenario {
  /** Switching to the target fails after moving the workspace there. */
  failSwitchTo?: string;
  /** Switching back fails too. */
  failSwitchBack?: boolean;
}

/** A workspace on /main/task1 with a changed file and an added one, and a `cm` that plays along. */
function workspaceWith(workspacePath: string, scenario: Scenario = {}) {
  let branch = '/main/task1';
  let pending = true;
  const executed: string[] = [];
  const cm = {
    async query(args: string[]) {
      const command = args.join(' ');
      if (command === 'status --header --xml') return header(branch, 1);
      if (args[0] === 'getworkspacefrompath') return 'a0411612-d36e-4eca-b9b5-97acad5969ea\n';
      if (args[0] === 'find' && args[1] === 'branch') return TASK1_BRANCH;
      if (command === 'status --xml --private') return withChanges(change('PR', 'src/new.txt'));
      if (args[0] === 'status' && args[1] === '--short') return '';
      if (args[0] === 'status') return pending ? withChanges(change('CH', 'src/a.txt'), change('AD', 'src/new.txt')) : withChanges();
      throw new Error(`Unexpected command: cm ${command}`);
    },
    async execute(args: string[]) {
      executed.push(args.slice(0, 2).join(' '));
      if (args[0] === 'undo') pending = false;
      if (args[0] === 'switch') {
        const target = args[1]!.replace(/^br:/, '');
        const back = target === '/main/task1';
        if (back ? scenario.failSwitchBack : target === scenario.failSwitchTo) {
          if (!back) branch = target;
          throw new Error('Access to the path is denied.');
        }
        branch = target;
      }
      return '';
    },
  } as unknown as CmClient;

  let settings = { switchShelves: [], restoreLeftChangesAutomatically: false } as unknown as AppSettings;
  const store = {
    get: () => settings,
    update: (changes: Partial<AppSettings>) => (settings = { ...settings, ...changes }),
  } as unknown as SettingsStore;
  const records = new SwitchShelveRecords(store);
  const finish = vi.fn(async () => {});
  const deps: SwitchDependencies = {
    cm,
    settings: store,
    records,
    leftChanges: { finish } as unknown as LeftChangesFinder,
    backupsRoot: join(workspacePath, '..', 'backups'),
  };
  return { deps, executed, records, finish, branch: () => branch };
}

const context: OperationContext = {
  signal: new AbortController().signal,
  reportProgress: () => {},
  beginStep: () => {},
  progressOf: () => () => {},
};

let workspacePath: string;

beforeEach(async () => {
  vi.mocked(applyShelveCleanly).mockClear();
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-switch-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src/new.txt'), 'added');
});

describe('switchWithChanges', () => {
  it('moves added files aside when bringing the changes too, so the target never gets them as private files', async () => {
    const { deps, finish } = workspaceWith(workspacePath);
    let addedFileDuringSwitch: boolean | undefined;
    vi.mocked(applyShelveCleanly).mockImplementationOnce(async () => {
      addedFileDuringSwitch = existsSync(join(workspacePath, 'src/new.txt'));
      return { kind: 'applied' };
    });

    expect(await switchWithChanges(deps, workspacePath, 'br:/main/task2', 'bring', context)).toEqual({ kind: 'brought' });
    expect(addedFileDuringSwitch).toBe(false);
    expect(finish).toHaveBeenCalledWith(workspacePath, expect.objectContaining({ backup: expect.objectContaining({ paths: ['src/new.txt'] }) }));
  });

  it('goes back to the source when the switch fails halfway, and puts the changes back there', async () => {
    const { deps, executed, finish, branch } = workspaceWith(workspacePath, { failSwitchTo: '/main/task2' });

    await expect(switchWithChanges(deps, workspacePath, 'br:/main/task2', 'leave', context)).rejects.toThrow(
      'Access to the path is denied. Your changes were put back.',
    );
    expect(executed).toEqual(['undo -r', 'switch br:/main/task2', 'switch br:/main/task1']);
    expect(branch()).toBe('/main/task1');
    expect(existsSync(join(workspacePath, 'src/new.txt'))).toBe(true);
    expect(finish).toHaveBeenCalled();
  });

  it('says where to go to restore the changes when it can’t go back either', async () => {
    const { deps, records, finish } = workspaceWith(workspacePath, { failSwitchTo: '/main/task2', failSwitchBack: true });

    await expect(switchWithChanges(deps, workspacePath, 'br:/main/task2', 'bring', context)).rejects.toThrow(
      'Access to the path is denied. Your changes are safe in shelve 7; switch back to /main/task1 to restore them.',
    );
    expect(finish).not.toHaveBeenCalled();
    expect(records.find({ shelveId: 7, repository: 'eco@local' })).toMatchObject({ mode: 'leave', source: { spec: 'br:/main/task1' } });
  });
});
