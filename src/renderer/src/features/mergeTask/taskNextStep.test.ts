// The merge words come with the menu's (`MENU_WORDS`), whose module reads the platform from the window.
import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { CodeReviewStatus, CodeReviewSummary, MergeRequestState } from '@shared/domain/codeReview';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import type { FinishedTask } from './finishedTask';
import { mergedCheckDestinationOf, conversationToRead, taskNextStepOf, taskNextStepView, type TaskNextStep, type TaskNextStepInput } from './taskNextStep';

const task = { name: '/main/release/task', parent: '/main/release' };

function request(id: number, state: MergeRequestState, review: Partial<CodeReviewSummary> = {}, destination = '/main'): CodeReviewSummary {
  return { ...codeReviewSummary({ id, title: `Task ${id}`, targetBranchId: 7, ...review }), mergeRequest: { state, destination } };
}

function openRequest(id: number, status: CodeReviewStatus, review: Partial<CodeReviewSummary> = {}): CodeReviewSummary {
  return request(id, 'Open', { status, ...review });
}

const plainReview = (id: number) => codeReviewSummary({ id, targetBranchId: 7 });

/** A clean task branch with changesets of its own, not merged, its reviews read. */
function input(reviewsOfBranch: readonly CodeReviewSummary[] | undefined, more: Partial<TaskNextStepInput> = {}): TaskNextStepInput {
  return { branch: task, hasChangesets: true, mergedInto: null, reviewsOfBranch, finished: null, ...more };
}

const kindOf = (step: TaskNextStep) => step.kind;

describe('taskNextStepOf, what Changes offers on a clean task branch', () => {
  it('offers to create a merge request when the branch has none', () => {
    expect(taskNextStepOf(input([]))).toEqual({ kind: 'create', branch: task });
    expect(taskNextStepOf(input([plainReview(4)]))).toEqual({ kind: 'create', branch: task });
  });

  it('offers to create one when the branch only has closed ones: they block nothing', () => {
    expect(kindOf(taskNextStepOf(input([request(9, 'Closed'), request(3, 'Closed')])))).toBe('create');
  });

  it('offers to create one when a merged request merged an older head: the branch has new work', () => {
    expect(kindOf(taskNextStepOf(input([request(6, 'Merged')])))).toBe('create');
  });

  it('a draft one is to get ready for review', () => {
    expect(taskNextStepOf(input([request(12, 'Draft')]))).toMatchObject({ kind: 'draft', request: { id: 12 } });
  });

  it('an open one waits for its reviewers, asks for rework or is reviewed, by its review status', () => {
    expect(taskNextStepOf(input([openRequest(12, 'Under review')]))).toMatchObject({ kind: 'waiting', request: { id: 12 } });
    expect(taskNextStepOf(input([openRequest(12, 'Rework required')]))).toMatchObject({ kind: 'rework', request: { id: 12 } });
    expect(taskNextStepOf(input([openRequest(12, 'Reviewed')]))).toMatchObject({ kind: 'reviewed', request: { id: 12 } });
  });

  it('a reviewed one merges its branch into its destination', () => {
    const step = taskNextStepOf(input([openRequest(12, 'Reviewed')]));
    expect(step.kind === 'reviewed' && step.merge).toEqual({
      request: { id: 12, title: 'Task 12', mergeRequest: { state: 'Open', destination: '/main' } },
      source: '/main/release/task',
      label: 'Merge into main…',
    });
  });

  it('goes by the newest request still to merge when the branch has several, over newer closed or merged ones', () => {
    const reviews = [request(20, 'Closed'), request(18, 'Merged'), request(15, 'Draft'), openRequest(11, 'Reviewed')];
    expect(taskNextStepOf(input(reviews))).toMatchObject({ kind: 'draft', request: { id: 15 } });
  });

  it('shows the finished task once merged, here or anywhere', () => {
    const finished: FinishedTask = { branch: task.name, destination: '/main', changesetId: 40, hidden: false };
    expect(taskNextStepOf(input([request(6, 'Merged')], { finished, mergedInto: 40 }))).toEqual({ kind: 'finished', task: finished });
    expect(taskNextStepOf(input(undefined, { finished, mergedInto: undefined }))).toEqual({ kind: 'finished', task: finished });
  });

  it('offers nothing for a branch with no changesets of its own, or none read yet', () => {
    expect(kindOf(taskNextStepOf(input([], { hasChangesets: false })))).toBe('none');
    expect(kindOf(taskNextStepOf(input([], { hasChangesets: undefined })))).toBe('none');
  });

  it('offers nothing for a top-level branch or one not read yet', () => {
    expect(kindOf(taskNextStepOf(input([], { branch: { name: '/main', parent: '' } })))).toBe('none');
    expect(kindOf(taskNextStepOf(input([], { branch: undefined })))).toBe('none');
  });

  it('offers nothing while asking whether it is merged, nor once a merge found is dismissed', () => {
    expect(kindOf(taskNextStepOf(input([], { mergedInto: undefined })))).toBe('none');
    expect(kindOf(taskNextStepOf(input([], { mergedInto: 40 })))).toBe('none');
  });

  it("shows nothing new until the reviews are read: never a Create that turns into something else", () => {
    expect(kindOf(taskNextStepOf(input(undefined, { mergedInto: undefined })))).toBe('none');
  });

  it("offers today's merge into the parent when the reviews couldn't be read", () => {
    expect(taskNextStepOf(input(undefined))).toEqual({ kind: 'mergeTask', branch: task });
  });
});

describe('mergedCheckDestinationOf, where the branch head is looked for as merged', () => {
  it("is the request's destination, which need not be the parent", () => {
    expect(mergedCheckDestinationOf(task, [openRequest(12, 'Under review')], false)).toBe('/main');
    expect(mergedCheckDestinationOf(task, [request(12, 'Draft', {}, '/main/release')], false)).toBe('/main/release');
  });

  it("is a merged request's destination when none is still to merge: its merge finished the task", () => {
    expect(mergedCheckDestinationOf(task, [request(9, 'Closed', {}, '/main/release'), request(6, 'Merged')], false)).toBe('/main');
  });

  it('is the parent when the branch has no request, or only closed ones', () => {
    expect(mergedCheckDestinationOf(task, [], false)).toBe('/main/release');
    expect(mergedCheckDestinationOf(task, [request(9, 'Closed'), plainReview(4)], false)).toBe('/main/release');
  });

  it("is none until the reviews are read, and the parent when they couldn't be", () => {
    expect(mergedCheckDestinationOf(task, undefined, false)).toBeUndefined();
    expect(mergedCheckDestinationOf(task, undefined, true)).toBe('/main/release');
  });

  it('is none for a branch that is no task', () => {
    expect(mergedCheckDestinationOf(undefined, [], false)).toBeUndefined();
    expect(mergedCheckDestinationOf({ name: '/main', parent: '' }, [], false)).toBeUndefined();
  });
});

describe('taskNextStepView, its line and buttons', () => {
  const view = (reviews: CodeReviewSummary[], quiet = false, open?: { changeRequests: number; questions: number }) =>
    taskNextStepView(taskNextStepOf(input(reviews)), { quiet, open });

  it('with no request: Create merge request first, then the merge into the parent, quiet', () => {
    expect(view([])).toEqual({ actions: [{ kind: 'create', label: 'Create merge request', primary: true }], mergesTask: true });
  });

  it("with the reviews unread: today's merge into the parent alone", () => {
    expect(taskNextStepView(taskNextStepOf(input(undefined)), { quiet: false })).toEqual({ actions: [], mergesTask: true });
  });

  it('a draft: its line, Ready for review first, then Open', () => {
    expect(view([request(12, 'Draft', { title: 'Login screen\nwith details' })])).toEqual({
      line: { reviewId: 12, state: 'Draft', number: '#12', title: 'Login screen', status: 'draft', tip: 'Draft merge request into /main' },
      actions: [
        { kind: 'readyForReview', label: 'Ready for review', primary: true, move: { to: 'Open', word: 'readyForReview' } },
        { kind: 'open', label: 'Open', primary: false },
      ],
      mergesTask: false,
    });
  });

  it('waiting: how many reviewers it waits for, each once', () => {
    const reviewers = [
      { name: 'ana', status: 'Under review' as const },
      { name: 'bob', status: 'Reviewed' as const },
      { name: 'cat', status: 'Under review' as const },
    ];
    expect(view([openRequest(12, 'Under review', { reviewers })]).line?.status).toBe('waiting for 2 reviewers');
    expect(view([openRequest(12, 'Under review', { reviewers: reviewers.slice(0, 2) })]).line?.status).toBe('waiting for 1 reviewer');
    expect(view([openRequest(12, 'Under review', { reviewers: [] })]).line?.status).toBe('no reviewers yet');
    expect(view([openRequest(12, 'Under review')]).actions).toEqual([{ kind: 'open', label: 'Open', primary: false }]);
  });

  it('rework: the change requests to apply once its conversation is read, else that changes are required', () => {
    expect(view([openRequest(12, 'Rework required')], false, { changeRequests: 3, questions: 1 }).line?.status).toBe('3 change requests to apply');
    expect(view([openRequest(12, 'Rework required')], false, { changeRequests: 1, questions: 0 }).line?.status).toBe('1 change request to apply');
    expect(view([openRequest(12, 'Rework required')], false, { changeRequests: 0, questions: 2 }).line?.status).toBe('changes required');
    expect(view([openRequest(12, 'Rework required')]).line?.status).toBe('changes required');
  });

  it('reviewed: Merge into the destination first, then Open', () => {
    const shown = view([openRequest(12, 'Reviewed')]);
    expect(shown.line?.status).toBe('reviewed');
    expect(shown.actions.map(({ kind, label, primary }) => ({ kind, label, primary }))).toEqual([
      { kind: 'merge', label: 'Merge into main…', primary: true },
      { kind: 'open', label: 'Open', primary: false },
    ]);
  });

  it('under a list, the single most useful action, quiet and named whole', () => {
    expect(view([], true)).toEqual({ actions: [{ kind: 'create', label: 'Create merge request', primary: false }], mergesTask: false });
    expect(view([request(12, 'Draft')], true).actions).toEqual([
      { kind: 'readyForReview', label: 'Mark merge request #12 ready for review', primary: false, move: { to: 'Open', word: 'readyForReview' } },
    ]);
    expect(view([openRequest(12, 'Under review')], true).actions).toEqual([{ kind: 'open', label: 'Open merge request #12', primary: false }]);
    expect(view([openRequest(12, 'Rework required')], true).actions).toEqual([{ kind: 'open', label: 'Open merge request #12', primary: false }]);
    expect(view([openRequest(12, 'Reviewed')], true).actions.map(({ label, primary }) => ({ label, primary }))).toEqual([{ label: 'Merge into main…', primary: false }]);
    expect(view([request(12, 'Draft')], true).line).toBeUndefined();
  });

  it('under a list with the reviews unread: the merge into the parent alone', () => {
    expect(taskNextStepView(taskNextStepOf(input(undefined)), { quiet: true })).toEqual({ actions: [], mergesTask: true });
  });
});

describe('conversationToRead', () => {
  it('reads the conversation of a request asking for rework with something open: the one a check-in reads too', () => {
    expect(conversationToRead(taskNextStepOf(input([openRequest(12, 'Rework required', { openIssueCount: 2 })])))).toBe(12);
  });

  it('reads nothing otherwise', () => {
    expect(conversationToRead(taskNextStepOf(input([openRequest(12, 'Rework required')])))).toBeUndefined();
    expect(conversationToRead(taskNextStepOf(input([openRequest(12, 'Under review', { openIssueCount: 2 })])))).toBeUndefined();
    expect(conversationToRead(taskNextStepOf(input([])))).toBeUndefined();
  });
});
