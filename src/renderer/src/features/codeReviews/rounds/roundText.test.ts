import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { checkinCommentText, checkinsText, roundText, shownCheckins, sinceText, MAX_SHOWN_CHECKINS } from './roundText';
import type { ReviewRound } from './reviewRounds';

const IN_MADRID = { locale: 'en-US', timeZone: 'Europe/Madrid' };

function round(fields: Partial<ReviewRound> = {}): ReviewRound {
  return { number: 1, reviewer: 'vio', status: 'Rework required', date: '2026-11-09T16:40:00+01:00', comment: '', applied: 0, discarded: 0, answered: 0, open: 0, folds: true, ...fields };
}

function changeset(id: number): Changeset {
  return { id, guid: `c${id}`, branch: '/main/waves', comment: `Fix ${id}`, owner: 'dani', date: '2026-11-10T09:00:00+01:00', parent: id - 1, repository: 'game@local' };
}

describe('roundText', () => {
  it("names the round, whose status closed it, and what it settled, the user's own as 'you'", () => {
    expect(roundText(round({ applied: 5, answered: 2 }), 'VIO', 2)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you · 5 requests applied, 2 questions answered' });
  });

  it("names another reviewer by the name shown, and every count it has", () => {
    expect(roundText(round({ number: 2, reviewer: 'ana.diaz@unity3d.com', status: 'Reviewed', applied: 1, discarded: 1, answered: 1 }), 'dani', 2)).toEqual({
      bold: 'Round 2',
      rest: ' · Reviewed by Ana Diaz · 1 request applied, 1 discarded, 1 question answered',
    });
  });

  it('says nothing was asked when the round held no request or question', () => {
    expect(roundText(round(), 'vio', 2)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you' });
  });

  it("leaves a review's only round unnamed: its line starts at what closed it, bold", () => {
    expect(roundText(round({ status: 'Reviewed', applied: 1 }), 'dani', 1)).toEqual({ bold: 'Reviewed', rest: ' by Vio · 1 request applied' });
    expect(roundText(round(), 'vio', 1)).toEqual({ bold: 'Rework required', rest: ' by you' });
  });

  it('counts what is still open in a round that does not fold', () => {
    expect(roundText(round({ applied: 1, open: 2, folds: false }), 'vio', 2)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you · 1 request applied, 2 open' });
  });
});

describe('sinceText', () => {
  it('dates the line by the day of the last review, in the reader’s time zone, the day apart to read quieter', () => {
    expect(sinceText('2026-11-09T23:30:00Z', IN_MADRID)).toEqual({ label: 'New since your last review', day: 'Nov 10' });
  });

  it('keeps the words when the date cannot be read', () => {
    expect(sinceText('not a date', IN_MADRID)).toEqual({ label: 'New since your last review' });
  });
});

describe('checkinsText', () => {
  it('says who checked in how many changesets', () => {
    expect(checkinsText({ changesets: [changeset(15), changeset(16)] })).toBe('checked in 2 changesets');
    expect(checkinsText({ changesets: [changeset(15)] })).toBe('checked in a changeset');
  });
});

describe('shownCheckins', () => {
  it('lists every changeset of a short batch', () => {
    const batch = [15, 16, 17].map(changeset);

    expect(shownCheckins(batch, false)).toEqual({ shown: batch, more: 0 });
  });

  it(`lists the first ${MAX_SHOWN_CHECKINS} of a longer batch and how many more, all once shown`, () => {
    const batch = [1, 2, 3, 4, 5, 6, 7].map(changeset);

    expect(shownCheckins(batch, false)).toEqual({ shown: batch.slice(0, MAX_SHOWN_CHECKINS), more: 2 });
    expect(shownCheckins(batch, true)).toEqual({ shown: batch, more: 0 });
  });

  it('never hides a single changeset behind "1 more"', () => {
    const batch = [1, 2, 3, 4, 5, 6].map(changeset);

    expect(shownCheckins(batch, false)).toEqual({ shown: batch, more: 0 });
  });
});

describe('checkinCommentText', () => {
  it("reads a changeset's comment's first line, or says it has none", () => {
    expect(checkinCommentText({ comment: 'Cap a single wave too\n\nAnd the boss wave' })).toBe('Cap a single wave too');
    expect(checkinCommentText({ comment: '' })).toBe('No comment');
  });
});
