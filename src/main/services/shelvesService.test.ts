import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOUND_SHELVES } from '../cm/foundObjects';
import { foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import type { SwitchContext } from './ServiceContext';
import { createShelvesService } from './shelvesService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function shelveRecord(id: number) {
  return { shelveid: id, comment: `Shelve ${id}`, date: '2026-09-25T10:00:00+02:00', owner: 'ana', repname: 'game', repserver: 'local', parent: 5, guid: `guid-${id}` };
}

describe('shelves', () => {
  it('lists shelves newest first with one cm find, which cannot sort them', async () => {
    const fake = fakeCmClient({ 'find shelve': recordsOutput(FOUND_SHELVES, shelveRecord(3), shelveRecord(9), shelveRecord(5)) });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    const listed = await service.list(WORKSPACE, { owners: ['me'], branch: '/main' });

    expect(fake.lines()).toEqual([foundLine(FOUND_SHELVES, "where owner = 'me'")]);
    expect(listed.map((shelve) => shelve.id)).toEqual([9, 5, 3]);
  });
});
