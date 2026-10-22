import { describe, expect, it } from 'vitest';
import { linkProblemWords } from './linkProblemWords';

describe('linkProblemWords', () => {
  it('offers an update only for a link naming what this version does not know', () => {
    expect(linkProblemWords({ kind: 'unknown', detail: 'It names a page "timeline".' })).toEqual({
      title: 'This link needs a newer version',
      message: 'It names a page "timeline". A newer version of the app may open it.',
      offersUpdate: true,
    });
    expect(linkProblemWords({ kind: 'malformed', detail: 'Its changeset number is not valid.' }).offersUpdate).toBe(false);
  });

  it('names what a link points to that is not there', () => {
    expect(linkProblemWords({ kind: 'notFound', what: 'label v1.2', repository: 'game' }).title).toBe("Label v1.2 isn't in game");
    expect(linkProblemWords({ kind: 'notInWorkspace', folder: '/tmp/x' })).toMatchObject({ title: 'No workspace holds this folder', message: '/tmp/x' });
  });
});
