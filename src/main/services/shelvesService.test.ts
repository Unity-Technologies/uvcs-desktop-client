import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findXml } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import type { SwitchContext } from './ServiceContext';
import { createShelvesService } from './shelvesService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function shelveRecord(id: number) {
  return { ID: id + 40, SHELVEID: id, COMMENT: `Shelve ${id}`, DATE: '2026-09-25T10:00:00+02:00', OWNER: 'ana', REPNAME: 'game', REPSERVER: 'local', PARENT: 5, GUID: `guid-${id}` };
}

describe('shelves', () => {
  it('lists shelves newest first with one cm find, which cannot sort them', async () => {
    const fake = fakeCmClient({ 'find shelve': findXml('SHELVE', shelveRecord(3), shelveRecord(9), shelveRecord(5)) });
    const service = createShelvesService(serviceContext(fake.cm), {} as SwitchContext);

    const listed = await service.list(WORKSPACE, { owners: ['me'], branch: '/main' });

    expect(fake.lines()).toEqual(["find shelve where owner = 'me' --xml --nototal"]);
    expect(listed.map((shelve) => shelve.id)).toEqual([9, 5, 3]);
  });
});
