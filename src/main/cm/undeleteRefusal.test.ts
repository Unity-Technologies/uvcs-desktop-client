import { describe, expect, it } from 'vitest';
import { undeleteRefusal } from './undeleteRefusal';

describe('undeleteRefusal', () => {
  it('says where the workspace already has the item, in its own words', () => {
    expect(undeleteRefusal("The item 35 is already loaded on tree on path '/src/Enemy.cs'.", 'src/Old/Enemy.cs')).toBe(
      'src/Old/Enemy.cs is already in the workspace, at src/Enemy.cs.',
    );
  });

  it('reads paths with spaces, accents and quotes', () => {
    expect(undeleteRefusal("The item 7 is already loaded on tree on path '/notes/Café 'menú'.txt'.\n", 'a.txt')).toBe(
      "a.txt is already in the workspace, at notes/Café 'menú'.txt.",
    );
  });

  it('says that xlinks can’t come back', () => {
    expect(undeleteRefusal('Undelete operation is not supported for xlinks.', 'lib')).toBe('lib is or holds an xlink, and xlinks can’t be restored.');
  });

  it('says the place is taken, should something take it after the app checked', () => {
    expect(undeleteRefusal('The restore path should not exist.', 'src/Enemy.cs')).toBe('src/Enemy.cs is already in the workspace. Restore it to another path.');
  });

  it('leaves any other failure as cm tells it', () => {
    expect(undeleteRefusal('Could not connect to the server.', 'src/Enemy.cs')).toBeNull();
  });
});
