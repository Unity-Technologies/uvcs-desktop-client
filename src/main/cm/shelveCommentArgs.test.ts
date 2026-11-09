import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { cmPlace } from './cmPlace';
import { shelveCommentArgs } from './shelveCommentArgs';

describe('shelveCommentArgs', () => {
  it("edits the shelve as the changeset below zero it is, cm's only way to reach its comment", () => {
    expect(shelveCommentArgs(12, 'c.txt', cmPlace(workspacePlace('/wk')))).toEqual(['changeset', 'editcomment', 'cs:-12', '-commentsfile=c.txt']);
  });

  it('names the repository when no workspace tells cm which', () => {
    expect(shelveCommentArgs(12, 'c.txt', cmPlace(repositoryPlace('game@local')))).toEqual(['changeset', 'editcomment', 'cs:-12@game@local', '-commentsfile=c.txt']);
  });
});
