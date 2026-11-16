import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import type { CodeReviewSummary, MergeRequestInfo } from '@shared/domain/codeReview';
import { blocksCreate, createdAs, defaultDestinationOf, mergeRequestForm, prefilledSourceOf, sourceGroups, defaultTitleOf, draftProblem, existingRequestNote, existingRequestOf, reviewsCheckOf, type MergeRequestDraft } from './mergeRequestDraft';

function review(id: number, mergeRequest?: MergeRequestInfo): CodeReviewSummary {
  return {
    id,
    title: `Review ${id}`,
    status: 'Under review',
    owner: 'ana',
    reviewers: [],
    date: '2026-11-10T10:00:00Z',
    lastActivity: '2026-11-10T10:00:00Z',
    commentCount: 0,
    openIssueCount: 0,
    targetBranchId: 26,
    ...(mergeRequest && { mergeRequest }),
  };
}

describe('defaultDestinationOf', () => {
  it("is the source's top-level ancestor, read from its name", () => {
    expect(defaultDestinationOf('/main/task')).toBe('/main');
    expect(defaultDestinationOf('/main/release/task')).toBe('/main');
    expect(defaultDestinationOf('/main/versión 2/tarea uno')).toBe('/main');
  });

  it('is its parent for a top-level branch that has one, and none for one that has none', () => {
    expect(defaultDestinationOf('/release', '/main')).toBe('/main');
    expect(defaultDestinationOf('/main', '')).toBeUndefined();
    expect(defaultDestinationOf('/main')).toBeUndefined();
    expect(defaultDestinationOf('')).toBeUndefined();
  });
});

describe('defaultTitleOf', () => {
  it("is the branch's own name when it has no comment", () => {
    expect(defaultTitleOf('/main/release/task-login', '')).toBe('task-login');
    expect(defaultTitleOf('/main/task', undefined)).toBe('task');
  });

  it("adds its comment's first line, so a tracker key in either survives", () => {
    expect(defaultTitleOf('/main/SCM-102', 'Add login\r\n\r\nWith the new provider')).toBe('SCM-102 - Add login');
    expect(defaultTitleOf('/main/task', '\n  Fix the crash  \nmore')).toBe('task - Fix the crash');
  });

  it('keeps a long name whole', () => {
    const name = 'a-very-long-task-name-that-goes-on-and-on-past-any-sensible-width-for-a-title';
    expect(defaultTitleOf(`/main/${name}`, '')).toBe(name);
  });

  it('is empty with no branch', () => {
    expect(defaultTitleOf('', 'Comment')).toBe('');
  });
});

describe('draftProblem', () => {
  const ready: MergeRequestDraft = { source: '/main/task', destination: '/main', title: 'Task' };

  it('finds none in a draft ready to create', () => {
    expect(draftProblem(ready)).toBeUndefined();
    expect(draftProblem({ ...ready, source: '/release', sourceParent: '/main' })).toBeUndefined();
  });

  it('asks for a branch, then a destination', () => {
    expect(draftProblem({ ...ready, source: '' })).toBe('Pick a branch to merge');
    expect(draftProblem({ ...ready, destination: '' })).toBe('Pick a destination');
  });

  it('refuses a branch merging into itself', () => {
    expect(draftProblem({ ...ready, destination: '/main/task' })).toBe("A branch can't merge into itself");
  });

  it('refuses a top-level branch read to have no parent, which has nowhere to merge', () => {
    expect(draftProblem({ ...ready, source: '/main', sourceParent: '', destination: '/release' })).toBe('A top-level branch has no merge request');
  });

  // Until the branch is read, a top-level name may still have a parent (`/release` from `/main`): no refusal shows.
  it('waits, refusing nothing, while a top-level branch is still read', () => {
    expect(draftProblem({ ...ready, source: '/release', destination: '/main' })).toBe('Reading the branch…');
    expect(draftProblem({ ...ready, source: '/main/task', destination: '/main' })).toBeUndefined();
  });

  it('refuses a destination made from the branch, at any depth', () => {
    expect(draftProblem({ ...ready, destination: '/main/task/sub' })).toBe("A branch can't merge into one made from it");
    expect(draftProblem({ ...ready, destination: '/main/task/sub/deeper' })).toBe("A branch can't merge into one made from it");
  });

  // Typing any branch is deliberate: only a name under the source's own is refused.
  it('allows a sibling whose name starts like the branch, and unrelated branches', () => {
    expect(draftProblem({ ...ready, destination: '/main/task-2' })).toBeUndefined();
    expect(draftProblem({ ...ready, destination: '/release/other' })).toBeUndefined();
  });

  it('asks for a title, blanks being none', () => {
    expect(draftProblem({ ...ready, title: '  ' })).toBe('The title is empty');
  });
});

describe('existingRequestOf', () => {
  const open = (id: number, destination = '/main') => review(id, { state: 'Open', destination });

  it('finds an Open or Draft request into the same destination', () => {
    expect(existingRequestOf([review(3), open(12)], '/main')).toEqual({ kind: 'active', review: open(12) });
    const draft = review(14, { state: 'Draft', destination: '/main' });
    expect(existingRequestOf([draft], '/main')).toEqual({ kind: 'active', review: draft });
  });

  it('takes an active one into another destination for no conflict', () => {
    expect(existingRequestOf([open(12, '/main/release')], '/main')).toBeUndefined();
  });

  it('notes a merged or closed one into that destination, the newest, when none is active', () => {
    const merged = review(9, { state: 'Merged', destination: '/main' });
    const closed = review(11, { state: 'Closed', destination: '/main' });
    expect(existingRequestOf([merged, closed], '/main')).toEqual({ kind: 'earlier', review: closed });
    expect(existingRequestOf([closed, open(15)], '/main')).toEqual({ kind: 'active', review: open(15) });
  });

  it('finds none among plain code reviews, or with no reviews or destination', () => {
    expect(existingRequestOf([review(3), review(4)], '/main')).toBeUndefined();
    expect(existingRequestOf([], '/main')).toBeUndefined();
    expect(existingRequestOf([open(12)], '')).toBeUndefined();
  });
});

describe('existingRequestNote', () => {
  it('names the active request, to open it, and why Create waits', () => {
    const active = { ...review(12, { state: 'Open', destination: '/main' }), title: 'Add login' };
    expect(existingRequestNote({ kind: 'active', review: active })).toEqual({
      text: 'This branch already has a merge request into /main:',
      request: { label: 'Add login', review: active },
      blocks: 'This branch already has a merge request into /main',
    });
  });

  it('names how an earlier one ended, to open it, without blocking', () => {
    const merged = { ...review(9, { state: 'Merged', destination: '/main' }), title: 'Add login' };
    expect(existingRequestNote({ kind: 'earlier', review: merged })).toEqual({ text: 'Merged before:', request: { label: 'Add login', review: merged } });
    const closed = review(9, { state: 'Closed', destination: '/main' });
    expect(existingRequestNote({ kind: 'earlier', review: closed })).toEqual({ text: 'Closed before:', request: { label: 'Review 9', review: closed } });
  });
});

describe('reviewsCheckOf', () => {
  it('is none with no branch, or once its reviews are in hand, even if a refresh of them failed', () => {
    expect(reviewsCheckOf('', undefined, false)).toBeUndefined();
    expect(reviewsCheckOf('/main/task', [], false)).toBeUndefined();
    expect(reviewsCheckOf('/main/task', [], true)).toBeUndefined();
  });

  it('is running until they come, and failed when the read did', () => {
    expect(reviewsCheckOf('/main/task', undefined, false)).toBe('checking');
    expect(reviewsCheckOf('/main/task', undefined, true)).toBe('failed');
  });
});

describe('createdAs', () => {
  it('is a merge request when the read review is one', () => {
    expect(createdAs(review(40, { state: 'Open', destination: '/main' }))).toBe('mergeRequest');
  });

  // A server older than merge requests makes a plain code review of what `cm mergerequest create` asks, saying nothing.
  it('is a code review when the server made a plain one', () => {
    expect(createdAs(review(40))).toBe('codeReview');
  });
});

describe('sourceGroups', () => {
  const branch = (name: string, date: string, parent = ''): Branch => ({ id: 1, name, parent, comment: '', owner: 'me', date, headChangeset: 1, guid: name, repository: 'repo@local' });

  it('offers the branches that can merge somewhere, newest first: nested ones, and top-level ones with a parent', () => {
    const branches = [
      branch('/main', '2010-01-01T00:00:00+01:00'),
      branch('/main/older', '2026-08-20T10:00:00+02:00', '/main'),
      branch('/release', '2026-09-01T10:00:00+02:00', '/main'),
      branch('/main/release/task', '2026-09-10T10:00:00+02:00', '/main/release'),
      branch('/orphan', '2026-09-20T10:00:00+02:00'),
    ];
    expect(sourceGroups(branches).map((group) => [group.title, group.branches.map((each) => each.name)])).toEqual([
      ['Branches', ['/main/release/task', '/release', '/main/older']],
    ]);
  });
});

describe('prefilledSourceOf', () => {
  it("starts on the workspace's branch when its name says it can merge somewhere", () => {
    expect(prefilledSourceOf('/main/task')).toBe('/main/task');
  });

  it('starts on no branch from a top-level one, or a workspace on no branch', () => {
    expect(prefilledSourceOf('/main')).toBeUndefined();
    expect(prefilledSourceOf(undefined)).toBeUndefined();
  });
});

describe('mergeRequestForm', () => {
  const task = { comment: 'Add login', parent: '/main' };
  const open = (id: number, destination = '/main') => review(id, { state: 'Open', destination });

  it('follows the branch: Into its top-level ancestor, the title its name and comment', () => {
    expect(mergeRequestForm({ source: '/main/release/task', sourceBranch: task })).toMatchObject({ destination: '/main', title: 'task - Add login', problem: undefined });
  });

  it('keeps a destination picked by hand when the branch changes', () => {
    expect(mergeRequestForm({ source: '/main/other', sourceBranch: task, picked: '/main/release' }).destination).toBe('/main/release');
  });

  it('keeps a title typed, even one typed and cleared, rather than the default', () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, typed: 'Login' }).title).toBe('Login');
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, typed: '' })).toMatchObject({ title: '', problem: 'The title is empty' });
  });

  it("titles a branch not read yet by its name, and a top-level one's Into by its parent once read", () => {
    expect(mergeRequestForm({ source: '/main/task' }).title).toBe('task');
    expect(mergeRequestForm({ source: '/release', sourceBranch: { comment: '', parent: '/main' } }).destination).toBe('/main');
  });

  it('blocks Create on a request still to merge into that destination only once the reviews are read', () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task })).toMatchObject({ note: undefined, problem: undefined });
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, reviewsOfBranch: [open(12)] })).toMatchObject({
      note: { request: { label: 'Review 12' } },
      problem: 'This branch already has a merge request into /main',
    });
  });

  it('notes an earlier request into that destination without blocking Create', () => {
    const merged = review(9, { state: 'Merged', destination: '/main' });
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, reviewsOfBranch: [merged] })).toMatchObject({
      note: { text: 'Merged before:', request: { label: 'Review 9' } },
      problem: undefined,
    });
  });

  // A server hiccup shouldn't stop the task: `cm` creates anyway, and a duplicate is visible and closable.
  it('says when the check for an existing request failed, and lets Create run', () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, reviewsCheck: 'failed' })).toMatchObject({
      note: { text: "Couldn't check whether this branch already has a merge request" },
      problem: undefined,
      tip: undefined,
    });
  });

  it("says in Create's tooltip that the check runs, and lets it run", () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, reviewsCheck: 'checking' })).toMatchObject({
      note: undefined,
      problem: undefined,
      tip: 'Checking for an existing merge request…',
    });
  });

  it("gives Create's tooltip the problem first, then the check", () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, typed: '', reviewsCheck: 'checking' }).tip).toBe('The title is empty');
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, reviewsOfBranch: [open(12)] }).tip).toBe('This branch already has a merge request into /main');
  });

  it("names a problem of the draft's own before an existing request", () => {
    expect(mergeRequestForm({ source: '/main/task', sourceBranch: task, typed: ' ', reviewsOfBranch: [open(12)] }).problem).toBe('The title is empty');
  });
});

describe('blocksCreate', () => {
  it('blocks only on a request still to merge', () => {
    expect(blocksCreate({ kind: 'active', review: review(12, { state: 'Open', destination: '/main' }) })).toBe(true);
    expect(blocksCreate({ kind: 'earlier', review: review(9, { state: 'Merged', destination: '/main' }) })).toBe(false);
    expect(blocksCreate(undefined)).toBe(false);
  });
});
