import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import type { Label } from '@shared/domain/label';
import type { Shelve } from '@shared/domain/shelve';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { branchFilterTexts } from '../../features/branches/branchFilters';
import { changesetFilterTexts } from '../../features/changesets/changesetFilters';
import { reviewFilterTexts } from '../../features/codeReviews/codeReviewFilters';
import { labelFilterTexts } from '../../features/labels/labelFilters';
import { shelveFilterTexts } from '../../features/shelves/shelveFilterTexts';
import { branchIndex, branchQueryText, changesetIndex, changesetSuggestion, codeReviewIndex, labelIndex, personIndex, shelveIndex } from './suggestionItems';
import { rankCandidates } from './suggestionRanking';

/** Queries a user types in a list's filter and after a trigger alike: case, several words, punctuation, accents. */
const QUERIES = ['Accelerator', 'ACCEL', 'merged accelerator', 'accelerator-v2:', 'v2 delete', 'scm1009064', 'ana', 'Díaz', 'diaz', 'cache Ana', '280712'];

const changesets: Changeset[] = [
  { id: 280712, guid: 'g1', branch: '/main/scm1009064', comment: 'HAL: merged /main/scm1009064: accelerator-v2: delete the old cache', owner: 'ana@acme.com', date: '2026-10-01', parent: 1, repository: 'game' },
  { id: 280711, guid: 'g2', branch: '/main', comment: 'Accelerator tuning\n\nThe second line says delete', owner: 'jose.diaz@acme.com', date: '2026-09-30', parent: 1, repository: 'game' },
  { id: 280700, guid: 'g3', branch: '/main/task', comment: 'Nothing to see', owner: 'Ana Díaz', date: '2026-09-29', parent: 1, repository: 'game' },
];
const branches: Branch[] = changesets.map((changeset, index) => ({
  id: index,
  name: changeset.branch,
  parent: '/main',
  comment: changeset.comment,
  owner: changeset.owner,
  date: changeset.date,
  headChangeset: changeset.id,
  guid: `b${index}`,
  repository: 'game',
}));
const labels: Label[] = changesets.map((changeset, index) => ({ id: index, name: `v${index}.0-accelerator`, changeset: changeset.id, branch: changeset.branch, comment: changeset.comment, owner: changeset.owner, date: changeset.date, repository: 'game' }));
const shelves: Shelve[] = changesets.map((changeset) => ({ id: changeset.id % 100, guid: changeset.guid, comment: changeset.comment, owner: changeset.owner, date: changeset.date, parentChangeset: changeset.parent, repository: 'game' }));
const reviews: CodeReviewSummary[] = changesets.map((changeset, index) => ({ id: index + 40, title: changeset.comment.split('\n')[0]!, status: 'Under review', owner: changeset.owner, assignee: '', date: changeset.date }) as CodeReviewSummary);
const people = changesets.map((changeset) => changeset.owner);

const EVERY = 1000;

describe('the suggestions match what the lists’ filter matches', () => {
  it('suggest a changeset exactly when the Changesets list keeps it', () => {
    for (const query of QUERIES) {
      const suggested = rankCandidates(changesetIndex(changesets), query, EVERY).map((changeset) => changeset.id).sort();
      const listed = changesets.filter((changeset) => matchesWordFilter(changesetFilterTexts(changeset), query)).map((changeset) => changeset.id).sort();
      expect(suggested, query).toEqual(listed);
    }
  });

  it('suggest a branch, a label, a shelve, a code review and a person exactly when their lists keep them', () => {
    for (const query of QUERIES) {
      const pairs: [unknown[], unknown[]][] = [
        [rankCandidates(branchIndex(branches), branchQueryText(query), EVERY), branches.filter((branch) => matchesWordFilter(branchFilterTexts(branch), query))],
        [rankCandidates(labelIndex(labels), query, EVERY), labels.filter((label) => matchesWordFilter(labelFilterTexts(label), query))],
        [rankCandidates(shelveIndex(shelves), query, EVERY), shelves.filter((shelve) => matchesWordFilter(shelveFilterTexts(shelve), query))],
        [rankCandidates(codeReviewIndex(reviews), query, EVERY), reviews.filter((review) => matchesWordFilter(reviewFilterTexts(review), query))],
        [rankCandidates(personIndex(people), query, EVERY), people.filter((person) => rankCandidates(personIndex([person]), query, 1).length > 0)],
      ];
      for (const [suggested, listed] of pairs) expect(new Set(suggested), query).toEqual(new Set(listed));
    }
  });

  it('keep their order on top of it: the number typed, then a name that starts with it', () => {
    expect(rankCandidates(changesetIndex(changesets), '280711', EVERY).map((changeset) => changeset.id)).toEqual([280711]);
    expect(rankCandidates(branchIndex(branches), 'main/task', EVERY)[0]?.name).toBe('/main/task');
  });
});

describe('a suggestion’s summary', () => {
  it('shows the match when it lies past what the row has room for, cut at its start', () => {
    const detail = changesetSuggestion(changesets[0]!, 'accelerator').detail!;
    expect(detail.startsWith('…')).toBe(true);
    expect(detail).toContain('accelerator-v2');
  });

  it('shows the line that matched when only the comment’s body holds the words', () => {
    expect(changesetSuggestion(changesets[1]!, 'says delete').detail).toContain('says delete');
  });

  it('shows its first line as it is when the match is in sight, or there’s nothing typed', () => {
    expect(changesetSuggestion(changesets[1]!, 'accelerator').detail).toBe('Accelerator tuning');
    expect(changesetSuggestion(changesets[0]!, '').detail).toBe('HAL: merged /main/scm1009064: accelerator-v2: delete the old cache');
  });
});
