import { describe, expect, it } from 'vitest';
import { linkProblemWords } from './linkProblemWords';

describe('linkProblemWords', () => {
  it('says a link naming what this version does not know is not supported, and offers an update without promising it', () => {
    expect(linkProblemWords({ kind: 'unknown' })).toEqual({
      title: "This link isn't supported",
      message: "This version of the app can't open this link.",
      offersUpdate: true,
    });
    expect(linkProblemWords({ kind: 'malformed', detail: 'Its changeset number is not valid.' }).offersUpdate).toBe(false);
  });

  it('names what a link points to that is not there', () => {
    expect(linkProblemWords({ kind: 'notFound', what: 'label v1.2', repository: 'game' }).title).toBe("Label v1.2 isn't in game");
    expect(linkProblemWords({ kind: 'notInWorkspace', folder: '/tmp/x' })).toMatchObject({ title: 'No workspace holds this folder', message: '/tmp/x' });
  });
});
