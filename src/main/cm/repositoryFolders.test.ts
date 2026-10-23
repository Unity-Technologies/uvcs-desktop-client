import { describe, expect, it } from 'vitest';
import { subfoldersIn } from './repositoryFolders';
import { recordsIn, recordsOutput } from './testing/cmOutput';
import { readTreeItem, TREE_ITEMS } from './treeItems';

/** `cm ls /Assets --tree=cs:4@lib@local` as `cm` prints it (the folder itself as `.`, then what it holds), read. */
const listing = recordsIn(
  recordsOutput(
    TREE_ITEMS,
    { name: '.', wkpath: '/Assets', type: 'dir' },
    { name: 'shaders', wkpath: '/Assets/shaders', type: 'dir' },
    { name: 'Readme.md', wkpath: '/Assets/Readme.md', type: 'txt' },
    { name: 'Art', wkpath: '/Assets/Art', type: 'dir' },
    { name: 'Ñandú', wkpath: '/Assets/Ñandú', type: 'dir' },
    { name: 'lib -> xlink -> / 3@other@local', wkpath: '/Assets/lib', type: 'dir' },
  ),
  readTreeItem,
);

describe('The folders of a repository’s tree', () => {
  it('lists only the folders inside, rooted at /, sorted by name whatever their case, non-ASCII names too', () => {
    expect(subfoldersIn(listing)).toEqual(['/Assets/Art', '/Assets/Ñandú', '/Assets/shaders']);
  });

  it('leaves out an xlink nested in it: an xlink can’t show a folder of it', () => {
    expect(subfoldersIn(listing)).not.toContain('/Assets/lib');
  });

  it('lists none in an empty folder', () => {
    expect(subfoldersIn(recordsIn(recordsOutput(TREE_ITEMS, { name: '.', wkpath: '/Empty', type: 'dir' }), readTreeItem))).toEqual([]);
  });
});
