import { describe, expect, it } from 'vitest';
import { formatOutput, recordsIn } from './testing/cmOutput';
import { readWorkspaceListedItem, workspaceListingArgs } from './workspaceListing';

const parseWorkspaceListing = (output: string) => recordsIn(output, readWorkspaceListedItem);

describe('workspaceListingArgs', () => {
  it("lists a workspace folder's children with what tells each file's revision, links as themselves", () => {
    expect(workspaceListingArgs('/work/Prop')).toEqual(['ls', '/work/Prop', '--format={wkpath}\u001f{type}\u001f{revid}\u001f{hash}\u001f{size}\u001f{repspec}\u001e', '--symlink']);
  });
});

describe('parseWorkspaceListing', () => {
  it('reads the files and the revisions they were loaded from, never the folder, a checkout or a private file', () => {
    // `cm ls <folder> --format=…` of a workspace, as cm prints it (a checkout lists -1 and the disk's hash).
    const output = formatOutput(
      ['Prop - Pumpkin', 'dir', 131, 'gEUrSyJHiFSO6gIeIYyPWw==', 0, 'rep:models@local'],
      ['Prop - Pumpkin/Pumpkin.obj', 'txt', 126, 'Q9oQU4Ghx0O0blJW3KZXFQ==', 1824576, 'rep:models@local'],
      ['Prop - Pumpkin/Skin.png', 'bin', 47, 'QhaUS90+y2xuOr5Q6yL/GQ==', 705189, 'rep:3dtest/models@MyOrg@unity'],
      ['Prop - Pumpkin/Edited.mtl', 'txt', -1, 'wZNJehoGssciMOYUb/RwgA==', 4, 'rep:models@local'],
      ['Prop - Pumpkin/notes.txt', 'txt', '', '', 5, ''],
    );

    expect(parseWorkspaceListing(output)).toEqual([
      { path: 'Prop - Pumpkin/Pumpkin.obj', revision: { revisionId: 126, repository: 'models@local' }, hash: 'Q9oQU4Ghx0O0blJW3KZXFQ==', size: 1824576 },
      { path: 'Prop - Pumpkin/Skin.png', revision: { revisionId: 47, repository: '3dtest/models@MyOrg@unity' }, hash: 'QhaUS90+y2xuOr5Q6yL/GQ==', size: 705189 },
    ]);
  });

  it("reads Windows' separators as /", () => {
    const output = formatOutput(['Prop\\Pumpkin.obj', 'txt', 126, 'aGFzaA==', 3, 'rep:models@local']);
    expect(parseWorkspaceListing(output)[0]?.path).toBe('Prop/Pumpkin.obj');
  });
});
