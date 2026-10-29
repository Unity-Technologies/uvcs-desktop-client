/// <reference types="node" />
import '../../testing/fakeWindow';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { COMMENT_SURFACES, focusModeFor } from './focusModeSurfaces';

const RENDERER = join(__dirname, '..', '..');

describe('focusModeFor', () => {
  const offering = COMMENT_SURFACES.filter((surface) => focusModeFor(surface).offered);

  it('opens one frame everywhere, the check-in’s panel over the window, its surfaces differing only in a title field', () => {
    // A branch's comment once filled its panel edge to edge, its hints inside the text; a changeset's had the frame.
    const frames = offering.map((surface) => {
      const { title: _title, ...frame } = focusModeFor(surface);
      return frame;
    });
    for (const frame of frames) expect(frame).toEqual({ offered: true, layout: 'overlay', toolbar: 'strip', hints: 'caption' });
  });

  it('gives a changeset’s or a shelve’s comment its title field over the description, as the check-in writes it, and any other none', () => {
    expect(offering.filter((surface) => focusModeFor(surface).title)).toEqual(['checkin', 'editCommentDialog', 'changesetDetails']);
  });

  it('offers no larger editor for a one-line comment: a merge’s comment, a code review’s title', () => {
    expect(focusModeFor('mergeComment').offered).toBe(false);
    expect(focusModeFor('codeReviewTitle').offered).toBe(false);
  });
});

describe('the comment editor’s focus mode', () => {
  it('has no in-place layout anywhere: a dialog’s larger editor is the overlay too', () => {
    const inPlace = filesUnder(RENDERER, (name) => isAppSource(name) || name.endsWith('.css'))
      // The layout's name as written, in code and CSS (`queryKeys.inPlace` is a query's place, not a layout).
      .filter((path) => !path.endsWith('.test.ts') && /['"]inPlace['"]/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(RENDERER.length + 1));
    expect(inPlace).toEqual([]);
  });

  it('is drawn by one panel, `CommentFocusGroup`: no field draws a larger editor of its own', () => {
    // `data-expanded` was a field's own larger editor; other parts of the app use the name for their own panes.
    const ownPanels = filesUnder(join(RENDERER, 'components', 'commentEditor'), (name) => isAppSource(name) || name.endsWith('.css'))
      .filter((path) => /data-expanded/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(RENDERER.length + 1));
    expect(ownPanels).toEqual([]);
  });
});
