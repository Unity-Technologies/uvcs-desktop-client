import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { linkDescription } from './linkDescription';

describe('linkDescription', () => {
  it.each([
    ['uvcs://acme.unity/repos/game/changesets/12/-/files/Assets/Player.cs#L4', 'Changeset 12 · Player.cs', 'game · acme · Unity organization'],
    ['uvcs://acme.unity/repos/game/branches/main/task001', 'Branch task001', 'game · acme · Unity organization'],
    ['uvcs://host:8087/repos/game/code-reviews/311', 'Code review 311', 'game · host:8087'],
    ['uvcs://local/repos/game', 'game', 'game · This computer'],
    ['uvcs:///Users/ana/wk/game/-/changes/a.cs', 'game · a.cs', '/Users/ana/wk/game'],
    ['uvcs://acme.unity/projects/Racing', 'Racing', 'Project · acme · Unity organization'],
    ['uvcs://acme.cloud', 'Repositories', 'acme · Cloud organization'],
  ])('says %s opens %s', (text, label, detail) => {
    expect(linkDescription(text)).toEqual({ label, detail });
  });

  it('shows a link it cannot read as written, opening it says why', () => {
    expect(linkDescription('uvcs://acme.unity/repos')).toEqual({ label: 'Open link', detail: 'uvcs://acme.unity/repos' });
  });
});
