import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { checkinsText, roundText, shownCheckins, sinceText, MAX_SHOWN_CHECKINS } from './roundText';
import type { ReviewRound } from './reviewRounds';

const IN_MADRID = { locale: 'en-US', timeZone: 'Europe/Madrid' };

function round(fields: Partial<ReviewRound> = {}): ReviewRound {
  return { number: 1, eventId: 2, reviewer: 'vio', status: 'Rework required', date: '2026-11-09T16:40:00+01:00', comment: '', applied: 0, discarded: 0, answered: 0, open: 0, folds: true, ...fields };
}

function changeset(id: number): Changeset {
  return { id, guid: `c${id}`, branch: '/main/waves', comment: `Fix ${id}`, owner: 'dani', date: '2026-11-10T09:00:00+01:00', parent: id - 1, repository: 'game@local' };
}

describe('roundText', () => {
  it("names the round, whose status closed it, and what it settled, the user's own as 'you'", () => {
    expect(roundText(round({ applied: 5, answered: 2 }), 'VIO', 2, false)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you', counts: ' · 5 requests applied, 2 questions answered', label: 'Round 1 · Rework required by you · 5 requests applied, 2 questions answered', dotBeforeTime: false });
  });

  it("names another reviewer by the name shown, and every count it has", () => {
    expect(roundText(round({ number: 2, reviewer: 'ana.diaz@unity3d.com', status: 'Reviewed', applied: 1, discarded: 1, answered: 1 }), 'dani', 2, false)).toEqual({
      bold: 'Round 2',
      rest: ' · Reviewed by Ana Diaz',
      counts: ' · 1 request applied, 1 discarded, 1 question answered',
      label: 'Round 2 · Reviewed by Ana Diaz · 1 request applied, 1 discarded, 1 question answered',
      dotBeforeTime: false,
    });
  });

  it('says nothing was asked when the round held no request or question', () => {
    expect(roundText(round(), 'vio', 2, false)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you', counts: '', label: 'Round 1 · Rework required by you', dotBeforeTime: false });
  });

  it("leaves a review's only round unnamed: its line starts at what closed it, bold", () => {
    expect(roundText(round({ status: 'Reviewed', applied: 1 }), 'dani', 1, false)).toEqual({ bold: 'Reviewed', rest: ' by Vio', counts: ' · 1 request applied', label: 'Reviewed by Vio · 1 request applied', dotBeforeTime: false });
    expect(roundText(round(), 'vio', 1, false)).toEqual({ bold: 'Rework required', rest: ' by you', counts: '', label: 'Rework required by you', dotBeforeTime: false });
  });

  it('counts what is still open in a round that does not fold', () => {
    expect(roundText(round({ applied: 1, open: 2, folds: false }), 'vio', 2, false)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you', counts: ' · 1 request applied, 2 open', label: 'Round 1 · Rework required by you · 1 request applied, 2 open', dotBeforeTime: false });
  });

  it('names the changeset the status was given at while folded, where a reviewer wrote it by hand: "Reviewed by Vio at 14"', () => {
    expect(roundText(round({ status: 'Reviewed', changesetId: 14, applied: 1 }), 'dani', 1, false)).toEqual({ bold: 'Reviewed', rest: ' by Vio at', changeset: 14, counts: ' · 1 request applied', label: 'Reviewed by Vio at 14 · 1 request applied', dotBeforeTime: false });
    expect(roundText(round({ changesetId: 14 }), 'vio', 2, false)).toEqual({ bold: 'Round 1', rest: ' · Rework required by you at', changeset: 14, counts: '', label: 'Round 1 · Rework required by you at 14', dotBeforeTime: true });
  });

  it('parts a changeset that ends the line from the time with a dot: "at 14 · 5 minutes ago", never "at 14 5 minutes ago"', () => {
    expect(roundText(round({ changesetId: 14 }), 'vio', 2, false).dotBeforeTime).toBe(true);
    expect(roundText(round({ changesetId: 14, applied: 1 }), 'vio', 2, false).dotBeforeTime).toBe(false);
    expect(roundText(round({ changesetId: 14 }), 'vio', 2, true).dotBeforeTime).toBe(false);
  });

  it("heads an unfolded round as whose review it was, leaving the verdict and its changeset to the status's own event at its end", () => {
    expect(roundText(round({ status: 'Reviewed', changesetId: 14, applied: 1 }), 'dani', 1, true)).toEqual({ bold: "Vio's review", rest: '', counts: ' · 1 request applied', label: "Vio's review · 1 request applied", dotBeforeTime: false });
    expect(roundText(round({ changesetId: 14 }), 'vio', 1, true)).toEqual({ bold: 'Your review', rest: '', counts: '', label: 'Your review', dotBeforeTime: false });
  });

  it('heads an unfolded round among others by its name, then whose review it was', () => {
    expect(roundText(round({ number: 2, reviewer: 'ana.diaz@unity3d.com', applied: 2 }), 'dani', 2, true)).toEqual({ bold: 'Round 2', rest: " · Ana Diaz's review", counts: ' · 2 requests applied', label: "Round 2 · Ana Diaz's review · 2 requests applied", dotBeforeTime: false });
    expect(roundText(round(), 'vio', 2, true)).toEqual({ bold: 'Round 1', rest: ' · your review', counts: '', label: 'Round 1 · your review', dotBeforeTime: false });
  });

  it('names none for a status given before the branch had a changeset, or on a review of a changeset or a shelve', () => {
    expect(roundText(round({ status: 'Reviewed' }), 'dani', 1, false)).toEqual({ bold: 'Reviewed', rest: ' by Vio', counts: '', label: 'Reviewed by Vio', dotBeforeTime: false });
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
