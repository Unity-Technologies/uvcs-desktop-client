import { describe, expect, it } from 'vitest';
import { CmError } from './CmError';
import { extractErrorMessage } from './errorMessage';
import { describeLockedItems, explainLockedItems, parseLockedItems } from './lockedItems';

const command = (commandLine: string) => ({ commandLine, exitCode: 1, output: '', logEntryId: 1 });

// As the server formats ITEMS_ALREADY_LOCKED (ItemsAlreadyLockedErrorBuilder): the header, then one line per item.
const ONE_LOCKED = 'These items are exclusively checked out by: \n/art/Hero.fbx (wk:ana-wk owner:ana)\n';
const TWO_LOCKED = 'These items are exclusively checked out by: \r\n/art/Hero.fbx (wk:ana-wk owner:ana)\r\n/art/Level (1).unity (wk:build owner:bob@corp.com)\r\n';

describe('parseLockedItems', () => {
  it('reads each locked item with its owner and workspace', () => {
    expect(parseLockedItems(ONE_LOCKED)).toEqual([{ path: '/art/Hero.fbx', workspace: 'ana-wk', owner: 'ana' }]);
    expect(parseLockedItems(TWO_LOCKED)).toEqual([
      { path: '/art/Hero.fbx', workspace: 'ana-wk', owner: 'ana' },
      { path: '/art/Level (1).unity', workspace: 'build', owner: 'bob@corp.com' },
    ]);
  });

  it('finds the list after whatever cm prints before it', () => {
    expect(parseLockedItems(`Error: ${ONE_LOCKED}`)).toHaveLength(1);
  });

  it('ignores other failures', () => {
    expect(parseLockedItems('The item /src/a.ts is not in the workspace.')).toBeNull();
    expect(parseLockedItems('These items are exclusively checked out by: ')).toBeNull();
  });
});

describe('describeLockedItems', () => {
  it('names the owner of a single item and what it blocks', () => {
    expect(describeLockedItems(parseLockedItems(ONE_LOCKED)!, 'checked out')).toBe(
      "Hero.fbx is locked by ana (workspace ana-wk), so it can't be checked out until the lock is released.",
    );
  });

  it('lists several items with their owners', () => {
    expect(describeLockedItems(parseLockedItems(TWO_LOCKED)!, 'checked in')).toBe(
      "2 items are locked by others, so they can't be checked in until the locks are released:\n/art/Hero.fbx — ana\n/art/Level (1).unity — bob@corp.com",
    );
  });
});

describe('explainLockedItems', () => {
  it('rewrites lock failures and keeps the command line', async () => {
    // As `CmClient` reports it: the message is one line of the output (`extractErrorMessage`), the items are in the output.
    const failed = { ...command('cm checkout /w/art/Hero.fbx'), output: ONE_LOCKED.trim() };
    const failing = () => Promise.reject(new CmError(extractErrorMessage(ONE_LOCKED), failed));
    await expect(explainLockedItems('checked out', failing)).rejects.toMatchObject({
      message: expect.stringContaining('locked by ana'),
      command: { commandLine: 'cm checkout /w/art/Hero.fbx' },
    });
  });

  it('passes other failures through', async () => {
    const error = new CmError('Something else', command('cm checkout'));
    await expect(explainLockedItems('checked out', () => Promise.reject(error))).rejects.toBe(error);
  });
});
