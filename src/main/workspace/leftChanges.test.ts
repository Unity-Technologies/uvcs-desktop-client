import { describe, expect, it } from 'vitest';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import type { SettingsStore } from '../settings/SettingsStore';
import { LeftChangesFinder } from './leftChanges';
import { SwitchShelveRecords } from './switchShelveRecords';

const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';

const STATUS_HEADER = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus>
    <Status>
      <RepSpec>
        <Server>local</Server>
        <Name>eco</Name>
      </RepSpec>
      <Changeset>1</Changeset>
    </Status>
  </WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>/main/task1@eco@local</WkConfigName>
</StatusOutput>`;

const shelves = (...entries: { id: number; comment: string }[]) => `<?xml version="1.0" encoding="utf-8" ?>
<PLASTICQUERY>
${entries
  .map(
    ({ id, comment }) => `  <SHELVE>
    <ID>${id + 46}</ID>
    <SHELVEID>${id}</SHELVEID>
    <COMMENT>${comment}</COMMENT>
    <DATE>2026-09-25T23:17:30+02:00</DATE>
    <OWNER>daniel.penalba@unity3d.com</OWNER>
    <REPOSITORY>eco</REPOSITORY>
    <REPNAME>eco</REPNAME>
    <REPSERVER>local</REPSERVER>
    <PARENT>1</PARENT>
    <GUID>c7558622-b4f1-49eb-9f76-639af4d7e906</GUID>
  </SHELVE>`,
  )
  .join('\n')}
</PLASTICQUERY>`;

const TASK1_BRANCH = `<?xml version="1.0" encoding="utf-8" ?>
<PLASTICQUERY>
  <BRANCH>
    <ID>37</ID>
    <COMMENT></COMMENT>
    <DATE>2026-09-25T23:16:33+02:00</DATE>
    <OWNER>daniel.penalba@unity3d.com</OWNER>
    <NAME>/main/task1</NAME>
    <PARENT>/main</PARENT>
    <REPOSITORY>eco</REPOSITORY>
    <REPNAME>eco</REPNAME>
    <REPSERVER>local</REPSERVER>
    <TYPE>T</TYPE>
    <CHANGESET>1</CHANGESET>
    <GUID>9b8e2f7a-58f3-4c43-9d83-3c2f1f5c1a10</GUID>
  </BRANCH>
</PLASTICQUERY>`;

const LEFT_ON_TASK1 = 'Automatic shelve created during switch operation (from br:37)';

function fakeCm(shelvesXml: string) {
  const commands: string[] = [];
  const cm = {
    async query(args: string[]) {
      commands.push(args.join(' '));
      if (args[0] === 'status') return STATUS_HEADER;
      if (args[0] === 'getworkspacefrompath') return `${WORKSPACE_GUID}\n`;
      if (args[0] === 'find' && args[1] === 'shelve') return shelvesXml;
      if (args[0] === 'find' && args[1] === 'branch') return TASK1_BRANCH;
      if (args[0] === 'diff') return '';
      throw new Error(`Unexpected command: cm ${args.join(' ')}`);
    },
  } as unknown as CmClient;
  return { cm, commands };
}

function recordsOf(records: SwitchShelveRecord[]): SwitchShelveRecords {
  let stored = records;
  const settings = {
    get: () => ({ switchShelves: stored }),
    update: (patch: { switchShelves: SwitchShelveRecord[] }) => (stored = patch.switchShelves),
  } as unknown as SettingsStore;
  return new SwitchShelveRecords(settings);
}

const ownRecord = (shelveId: number, sourceSpec: string): SwitchShelveRecord => ({
  workspaceGuid: WORKSPACE_GUID,
  shelveId,
  repository: 'eco@local',
  source: { spec: sourceSpec, name: sourceSpec.slice(3), objectRef: 'br:37' },
  target: { spec: 'br:/main', name: '/main' },
  mode: 'leave',
  createdAt: '2026-09-25T21:17:30.000Z',
  paths: ['src/file4.txt'],
  changelists: [],
});

describe('LeftChangesFinder', () => {
  it("doesn't look the branch up when no automatic shelve could have been left by another client", async () => {
    const { cm, commands } = fakeCm(shelves({ id: 2, comment: LEFT_ON_TASK1 }));
    const finder = new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main/task1')]));

    expect(await finder.find('/work')).toEqual([expect.objectContaining({ shelveId: 2, foreign: false })]);
    expect(commands.some((command) => command.startsWith('find branch'))).toBe(false);
  });

  it('finds the changes another client left on the branch by its object id', async () => {
    const { cm, commands } = fakeCm(shelves({ id: 2, comment: LEFT_ON_TASK1 }, { id: 3, comment: 'Automatic shelve created during switch operation (from br:4)' }));
    const finder = new LeftChangesFinder(cm, recordsOf([]));

    expect(await finder.find('/work')).toEqual([expect.objectContaining({ shelveId: 2, foreign: true })]);
    expect(commands).toContain("find branch where name = 'task1' --xml --nototal");
  });

  it('offers changes still waiting to be brought elsewhere as left here, once the workspace is back where they were made', async () => {
    const { cm } = fakeCm(shelves({ id: 2, comment: LEFT_ON_TASK1 }));
    const bringing: SwitchShelveRecord = { ...ownRecord(2, 'br:/main/task1'), mode: 'bring' };

    expect(await new LeftChangesFinder(cm, recordsOf([bringing])).find('/work')).toEqual([
      expect.objectContaining({ shelveId: 2, mode: 'leave', sourceName: '/main/task1', targetName: '/main' }),
    ]);
    expect(await new LeftChangesFinder(cm, recordsOf([bringing])).hasOwnWaiting('/work')).toBe(true);
  });

  it("tells whether this app left changes on what the workspace is on, without asking the server", async () => {
    const { cm, commands } = fakeCm(shelves());

    expect(await new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main/task1')])).hasOwnWaiting('/work')).toBe(true);
    expect(await new LeftChangesFinder(cm, recordsOf([ownRecord(2, 'br:/main')])).hasOwnWaiting('/work')).toBe(false);
    expect(commands.every((command) => command.startsWith('status') || command.startsWith('getworkspacefrompath'))).toBe(true);
  });
});
