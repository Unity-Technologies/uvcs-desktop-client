import { describe, expect, it } from 'vitest';
import { conversationOf, FOUND_REVIEW_COMMENTS } from './reviewCommentRecords';
import { recordsIn, recordsOutput } from './testing/cmOutput';

const ANA = 'ana@acme.com';
const AT = '2026-11-06T11:38:27.0000000+01:00';
const LATER = '2026-11-06T11:40:02.0000000+01:00';

/** A comment as `cm find changereviewcomment` prints it; a general one unless the test says otherwise. */
function printed(fields: Partial<Record<(typeof FOUND_REVIEW_COMMENTS.fields)[number], string | number>>) {
  return {
    owner: ANA,
    date: AT,
    modifieddate: AT,
    type: 'conversation',
    parent: -1,
    revisionid: -1,
    itemid: '',
    path: '',
    line: '',
    changeset: -1,
    appliedinchangeset: -1,
    ...fields,
  };
}

const conversationIn = (...comments: ReturnType<typeof printed>[]) => conversationOf(recordsIn(recordsOutput(FOUND_REVIEW_COMMENTS, ...comments), FOUND_REVIEW_COMMENTS));

describe('conversationOf', () => {
  it('reads a general comment, keeping its lines as written', () => {
    const { comments } = conversationIn(printed({ id: 44, guid: 'b65e', comment: 'Nice work.\nCould we add a test?\n' }));

    expect(comments).toEqual([{ id: 44, guid: 'b65e', author: ANA, date: AT, text: 'Nice work.\nCould we add a test?\n', kind: 'general', anchor: { kind: 'review' } }]);
  });

  it('places a comment on a line of a revision, with the item and its path', () => {
    const { comments } = conversationIn(printed({ id: 46, guid: 'c1', comment: 'Shelve first.', type: 'change', revisionid: 29, itemid: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 }));

    expect(comments[0]).toMatchObject({ kind: 'changeRequest', anchor: { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } });
  });

  it('reads each kind cm prints', () => {
    const kinds = conversationIn(
      printed({ id: 1, type: 'conversation' }),
      printed({ id: 2, type: 'comment', revisionid: 3, line: 1 }),
      printed({ id: 3, type: 'change', revisionid: 3, line: 1 }),
      printed({ id: 4, type: 'question', revisionid: 3, line: 1 }),
      printed({ id: 5, type: 'discarded', parent: 3, revisionid: 3, line: 1 }),
    ).comments.map((comment) => comment.kind);

    expect(kinds).toEqual(['general', 'comment', 'changeRequest', 'question', 'discard']);
  });

  it("reads a trigger's script comment as what it's on", () => {
    const { comments } = conversationIn(printed({ id: 1, type: 'script' }), printed({ id: 2, type: 'script', revisionid: 3, line: 4 }));

    expect(comments.map((comment) => comment.kind)).toEqual(['general', 'comment']);
  });

  it('keeps who a reply answers, the changeset a comment was written in, and the one that applied a change request', () => {
    const { comments } = conversationIn(
      printed({ id: 47, type: 'change', revisionid: 29, line: 14, appliedinchangeset: 4 }),
      printed({ id: 56, type: 'comment', revisionid: 29, line: 12, changeset: 2 }),
      printed({ id: 45, type: 'comment', parent: 44 }),
    );

    expect(comments).toMatchObject([{ appliedInChangeset: 4 }, { changesetId: 2 }, { parentId: 44 }]);
    expect(comments[0]).not.toHaveProperty('parentId');
    expect(comments[0]).not.toHaveProperty('changesetId');
    expect(comments[1]).not.toHaveProperty('appliedInChangeset');
  });

  it('says when a comment was edited, and nothing for one never edited', () => {
    const { comments } = conversationIn(printed({ id: 1, modifieddate: LATER }), printed({ id: 2 }));

    expect(comments.map((comment) => comment.editedDate)).toEqual([LATER, undefined]);
  });

  it('takes the newest description, its prefix left out, and leaves it out of the events', () => {
    const conversation = conversationIn(
      printed({ id: 43, guid: 'd1', type: 'timeline', comment: '[description]First words' }),
      printed({ id: 60, guid: 'd2', type: 'timeline', comment: '[description]Switching **never loses**\n\nchanges.', modifieddate: LATER }),
    );

    expect(conversation.description).toEqual({ id: 60, guid: 'd2', text: 'Switching **never loses**\n\nchanges.', author: ANA, date: AT, editedDate: LATER });
    expect(conversation.events).toEqual([]);
  });

  it('reads the events the server writes, oldest first, and what each means', () => {
    const { events } = conversationIn(
      printed({ id: 42, type: 'timeline', comment: '[requested-review-from]ana@acme.com;qa-team' }),
      printed({ id: 57, type: 'timeline', comment: '[renamed-title]Switch with changes#->#Switching keeps them' }),
      printed({ id: 58, guid: 's1', type: 'timeline', comment: '[status-rework-required]Two changes\nbefore it goes in.' }),
      printed({ id: 59, guid: 's2', type: 'timeline', comment: '[status-reviewed]' }),
      printed({ id: 61, guid: 's3', type: 'timeline', comment: '[status-under-review]' }),
      printed({ id: 62, type: 'timeline', comment: '[re-requested-review-from]bob@acme.com' }),
      printed({ id: 63, type: 'timeline', comment: '[removed-requested-review-from]qa-team' }),
    );

    expect(events.map(({ id, author, date, ...change }) => change)).toEqual([
      { kind: 'reviewRequested', reviewers: ['ana@acme.com', 'qa-team'] },
      { kind: 'titleChanged', from: 'Switch with changes', to: 'Switching keeps them' },
      { kind: 'statusChanged', status: 'Rework required', comment: 'Two changes\nbefore it goes in.', guid: 's1' },
      { kind: 'statusChanged', status: 'Reviewed', comment: '', guid: 's2' },
      { kind: 'statusChanged', status: 'Under review', comment: '', guid: 's3' },
      { kind: 'reviewRequestedAgain', reviewer: 'bob@acme.com' },
      { kind: 'reviewerRemoved', reviewer: 'qa-team' },
    ]);
    expect(events[0]).toMatchObject({ id: 42, author: ANA, date: AT });
  });

  it("keeps a title holding the separator's characters whole after the first one", () => {
    const { events } = conversationIn(printed({ id: 1, type: 'timeline', comment: '[renamed-title]A#->#B #-># C' }));

    expect(events[0]).toMatchObject({ kind: 'titleChanged', from: 'A', to: 'B #-># C' });
  });

  it("reads an older server's review request, which names no one, and keeps what it doesn't know as text", () => {
    const { events } = conversationIn(
      printed({ id: 1, type: 'timeline', comment: '[requested-review-from-0a1b2c]' }),
      printed({ id: 2, type: 'timeline', comment: '[mergerequest-status-draft-to-open]' }),
    );

    expect(events.map(({ id, author, date, ...change }) => change)).toEqual([
      { kind: 'reviewRequested', reviewers: [] },
      { kind: 'other', text: '[mergerequest-status-draft-to-open]' },
    ]);
  });

  it('reads nothing from a review nobody said anything on', () => {
    expect(conversationIn()).toEqual({ comments: [], events: [] });
  });
});
