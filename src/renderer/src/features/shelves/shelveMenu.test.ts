import { describe, expect, it, vi } from 'vitest';
import type { Shelve } from '@shared/domain/shelve';
import { isSubmenu, SEPARATOR, type MenuEntry } from '../../lib/actions';
import { shelveMenu } from './shelveMenu';

// What the entries run needs the app around them.
vi.mock('./shelveOperations', () => ({}));
vi.mock('../codeReviews/CreateCodeReviewDialog', () => ({}));
vi.mock('../../lib/copyToClipboard', () => ({}));

const shelve: Shelve = { id: 12, guid: 'g', comment: 'Spike', owner: 'jane.doe@unity3d.com', date: '2026-09-27T10:00:00Z', parentChangeset: 4, repository: 'eco@local' };

const ids = (entries: MenuEntry[]): string[] => entries.flatMap((entry) => (entry !== SEPARATOR && !isSubmenu(entry) ? [entry.id] : []));

describe('shelveMenu', () => {
  it("offers everything on the user's own shelve", () => {
    expect(ids(shelveMenu('/ws', [shelve]))).toEqual(['apply', 'applyAndDelete', 'diff', 'codeReview', 'copy', 'delete']);
  });

  it("only applies, shows, reviews and copies someone else's: deleting it is theirs to do", () => {
    expect(ids(shelveMenu('/ws', [shelve], { mine: false }))).toEqual(['apply', 'diff', 'codeReview', 'copy']);
  });
});
