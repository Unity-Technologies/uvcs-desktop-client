import { describe, expect, it } from 'vitest';
import { linkInText } from './linkInText';

describe('linkInText', () => {
  it('takes a link as it is, either scheme, even one that does not read', () => {
    expect(linkInText('  uvcs://acme.unity/repos/game/changesets/12 ')).toBe('uvcs://acme.unity/repos/game/changesets/12');
    expect(linkInText('plastic://acme.cloud/repos/game/changesets/12/diff')).toBe('plastic://acme.cloud/repos/game/changesets/12/diff');
    expect(linkInText('uvcs://acme.unity/nothing')).toBe('uvcs://acme.unity/nothing');
  });

  it("takes the link inside the official client's web page, encoded or not", () => {
    expect(linkInText('https://cloud.unity.com/public/plastic-scm/desktop?url=plastic://acme.cloud/repos/game/changesets/12/diff')).toBe(
      'plastic://acme.cloud/repos/game/changesets/12/diff',
    );
    expect(linkInText('https://cloud.unity.com/public/plastic-scm/desktop?url=plastic%3A%2F%2Facme.cloud%2Frepos%2Fgame%2Fchangesets%2F12%2Fdiff')).toBe(
      'plastic://acme.cloud/repos/game/changesets/12/diff',
    );
  });

  it('writes a spec naming its repository as a link', () => {
    expect(linkInText('cs:4207@game@acme@unity')).toBe('uvcs://acme.unity/repos/game/changesets/4207');
    expect(linkInText('br:/main/task@game@local')).toBe('uvcs://local/repos/game/branches/main/task');
  });

  it.each(['Player.cs', 'cs:4207', 'https://example.com/?url=hello', 'https://example.com/page', ''])('finds no link in %j', (text) => {
    expect(linkInText(text)).toBeNull();
  });
});
