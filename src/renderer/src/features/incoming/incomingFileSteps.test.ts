import { describe, expect, it } from 'vitest';
import { incomingFileStepKeys } from './incomingFileSteps';

const file = (path: string, itemType = 'text') => ({ type: 'file', key: path, item: { itemType } });

describe('incomingFileStepKeys', () => {
  it("steps through Incoming's files as the list shows them, past a diff's last change on to the next file", () => {
    expect(incomingFileStepKeys([file('a.cs'), file('logo.png', 'binary'), file('b.cs')])).toEqual(['a.cs', 'logo.png', 'b.cs']);
  });

  it('skips folders and the headers of groups, which show no diff', () => {
    const rows = [{ type: 'group', key: 'group:changed' }, file('Assets', 'directory'), file('Assets/a.cs')];
    expect(incomingFileStepKeys(rows)).toEqual(['Assets/a.cs']);
  });
});
