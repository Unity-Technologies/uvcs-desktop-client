import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';
import { change, formatOutput, pendingStatus } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { hasPendingChanges } from './hasPendingChanges';

const WORKSPACE = join('/', 'wk');
const HEADER = ['STATUS', 7, 'game', 'local'];

describe('hasPendingChanges', () => {
  it('reads the controlled changes as records, as they arrive, in the workspace', async () => {
    const { cm, commands } = fakeCmClient({ status: pendingStatus(WORKSPACE) });

    await hasPendingChanges(cm, WORKSPACE);

    expect(commands).toMatchObject([
      { via: 'query', readsRecords: true, args: statusRecordsArgs('--controlledchanged', '--changed', '--localdeleted'), options: { cwd: WORKSPACE } },
    ]);
  });

  it('tells a change, and nothing but the header for none', async () => {
    const changed = fakeCmClient({ status: pendingStatus(WORKSPACE, change('CH', 'src/a.txt')) });
    const clean = fakeCmClient({ status: pendingStatus(WORKSPACE) });

    expect(await hasPendingChanges(changed.cm, WORKSPACE)).toBe(true);
    expect(await hasPendingChanges(clean.cm, WORKSPACE)).toBe(false);
  });

  it("counts a file's conflict markers as no change of their own", async () => {
    const { cm } = fakeCmClient({ status: formatOutput(HEADER, ['CONFLICT_MARKERS', join(WORKSPACE, 'a.txt')]) });

    expect(await hasPendingChanges(cm, WORKSPACE)).toBe(false);
  });
});
