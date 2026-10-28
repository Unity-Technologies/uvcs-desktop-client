/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { COMMENT_SURFACES, focusModeFor } from './focusModeSurfaces';

const RENDERER = join(__dirname, '..', '..');

describe('focusModeFor', () => {
  it('opens the same larger editor everywhere: the check-in’s panel over the window, never a field grown in place', () => {
    for (const surface of COMMENT_SURFACES) expect(focusModeFor(surface).layout, surface).toBe('overlay');
  });

  it('opens a changeset’s comment as a title over its description, as the check-in writes it, and any other as one description', () => {
    expect(focusModeFor('checkin').fields).toBe('titleAndDescription');
    expect(focusModeFor('editCommentDialog').fields).toBe('titleAndDescription');
    expect(focusModeFor('changesetDetails').fields).toBe('titleAndDescription');
    for (const surface of ['namedObjectDetails', 'newBranch', 'newLabel', 'newAttribute'] as const) expect(focusModeFor(surface).fields, surface).toBe('description');
  });

  it('keeps every field compact out of focus mode: the toolbar and the hints show only in the larger editor', () => {
    for (const surface of COMMENT_SURFACES) expect(focusModeFor(surface), surface).toMatchObject({ toolbar: 'inFocusMode', hints: 'inFocusMode' });
  });

  it('offers no larger editor for a one-line comment: a merge’s comment, a code review’s title', () => {
    expect(focusModeFor('mergeComment').fields).toBe('none');
    expect(focusModeFor('codeReviewTitle').fields).toBe('none');
  });
});

describe('the comment editor’s focus mode', () => {
  it('has no in-place layout anywhere: a dialog’s larger editor is the overlay too', () => {
    const inPlace = filesUnder(RENDERER, isAppSource)
      .filter((path) => !path.endsWith('.test.ts') && /inPlace/.test(readFileSync(path, 'utf8')))
      .map((path) => path.slice(RENDERER.length + 1));
    expect(inPlace).toEqual([]);
  });
});
