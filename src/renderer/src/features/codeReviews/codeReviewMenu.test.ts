import { fakeApi } from '../../testing/fakeWindow';
import { answerConfirms } from '../../testing/fakeDialogs';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { codeReviewSummary } from '../../testing/codeReviewSummary';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

const ran = vi.hoisted(() => [] as string[]);
vi.mock('../branches/branchOperations', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  switchToBranch: async (workspacePath: string, branch: string) => void ran.push(`switch ${workspacePath} ${branch}`),
}));
vi.mock('../changesets/changesetOperations', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  switchToChangeset: async (workspacePath: string, changeset: { id: number }) => void ran.push(`switch ${workspacePath} cs:${changeset.id}`),
}));
vi.mock('../shelves/shelveOperations', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  applyShelve: async (workspacePath: string, shelveId: number, andDelete: boolean) => void ran.push(`apply ${workspacePath} sh:${shelveId}${andDelete ? ' and delete' : ''}`),
}));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { CodeReview, CodeReviewSummary, CodeReviewTarget } from '@shared/domain/codeReview';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { SEPARATOR, type Action, type MenuEntry } from '../../lib/actions';
import { navigation } from '../../app/navigation/navigationStore';
import { codeReviewPage } from './codeReviewOperations';
import { codeReviewMenu, reviewPageMenu } from './codeReviewMenu';

const ws = '/ws';
const summary: CodeReviewSummary = codeReviewSummary({ id: 9, title: 'Review the task', owner: 'jane@example.com', date: '2026-09-27T10:00:00Z' });
const reviewOf = (target: CodeReviewTarget): CodeReview => ({ ...summary, target });
const onBranch = (name: string): WorkspaceSelector => ({ kind: 'branch', name });

const actions = (menu: MenuEntry[]): Action[] => menu.filter((entry): entry is Action => entry !== SEPARATOR && 'run' in entry);
/** The entry that brings the reviewed code to the workspace, as people read it: its words, and why it's off. */
const reviewedCodeEntry = (menu: MenuEntry[]) =>
  actions(menu)
    .filter((entry) => entry.id === 'switch' || entry.id === 'apply')
    .map(({ id, label, disabled, disabledReason }) => ({ id, label, disabled: disabled ?? false, ...(disabledReason && { disabledReason }) }));

beforeEach(() => void ran.splice(0));

describe('getting the reviewed code into the workspace', () => {
  it("switches to a branch review's branch", async () => {
    const menu = codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'branch', branch: '/main/task' })], onBranch('/main'));
    expect(reviewedCodeEntry(menu)).toEqual([{ id: 'switch', label: 'Switch to this branch', disabled: false }]);

    await actions(menu).find((entry) => entry.id === 'switch')!.run();
    expect(ran).toEqual(['switch /ws /main/task']);
  });

  it("switches to a changeset review's changeset", async () => {
    const menu = codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'changeset', changesetId: 42 })], onBranch('/main'));
    expect(reviewedCodeEntry(menu)).toEqual([{ id: 'switch', label: 'Switch to this changeset', disabled: false }]);

    await actions(menu).find((entry) => entry.id === 'switch')!.run();
    expect(ran).toEqual(['switch /ws cs:42']);
  });

  it("applies a shelve review's shelve to the workspace, keeping the shelve: it's someone else's", async () => {
    const menu = codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'shelve', shelveId: 3 })], onBranch('/main'));
    expect(reviewedCodeEntry(menu)).toEqual([{ id: 'apply', label: 'Apply to workspace', disabled: false }]);

    await actions(menu).find((entry) => entry.id === 'apply')!.run();
    expect(ran).toEqual(['apply /ws sh:3']);
  });

  it('stays in its place, disabled, where the workspace already is', () => {
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'branch', branch: '/main/task' })], onBranch('/main/task')))).toEqual([
      { id: 'switch', label: 'Switch to this branch', disabled: true, disabledReason: 'The workspace is already on this branch' },
    ]);
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'changeset', changesetId: 42 })], { kind: 'changeset', name: '42' }))).toEqual([
      { id: 'switch', label: 'Switch to this changeset', disabled: true, disabledReason: 'The workspace is already on this changeset' },
    ]);
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'shelve', shelveId: 3 })], { kind: 'shelve', name: '3' }))).toEqual([
      { id: 'apply', label: 'Apply to workspace', disabled: true, disabledReason: 'The workspace is already on this shelve' },
    ]);
  });

  it("switches to a changeset the workspace's branch has loaded: that leaves the branch for the changeset alone", () => {
    const menu = codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'changeset', changesetId: 42 })], onBranch('/main'));
    expect(reviewedCodeEntry(menu)[0]!.disabled).toBe(false);
  });

  it("is enabled while what the workspace is on isn't read yet: the switch itself checks", () => {
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'branch', branch: '/main/task' })]))).toEqual([
      { id: 'switch', label: 'Switch to this branch', disabled: false },
    ]);
  });

  it("isn't offered where the reviewed code is unknown: a deleted branch, or a review listed without its target", () => {
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'unknown', description: 'an unknown branch' })], onBranch('/main')))).toEqual([]);
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), [summary], onBranch('/main')))).toEqual([]);
  });

  it("isn't offered in a repository explored without a workspace: there is none to bring the code to", () => {
    for (const target of [{ kind: 'branch', branch: '/main/task' }, { kind: 'changeset', changesetId: 12 }, { kind: 'shelve', shelveId: 4 }] as CodeReviewTarget[]) {
      expect(reviewedCodeEntry(codeReviewMenu(repositoryPlace('game@local'), [reviewOf(target)]))).toEqual([]);
    }
  });

  it('is offered for one review only', () => {
    const reviews = [reviewOf({ kind: 'branch', branch: '/main/a' }), { ...reviewOf({ kind: 'branch', branch: '/main/b' }), id: 10 }];
    expect(reviewedCodeEntry(codeReviewMenu(workspacePlace(ws), reviews, onBranch('/main')))).toEqual([]);
  });

  it('comes right after the ways to open the review, here or in a new window, as what the review does to the workspace', () => {
    const menu = codeReviewMenu(workspacePlace(ws), [reviewOf({ kind: 'branch', branch: '/main/task' })], onBranch('/main'));
    expect(actions(menu).map((entry) => entry.id).slice(0, 3)).toEqual(['openReview', 'reviewInNewWindow', 'switch']);
  });
});

describe("a review's page menu", () => {
  it('leaves the page of a review it deleted, and stays on one it kept', async () => {
    fakeApi.answer('codeReviews.remove', () => undefined);
    const deleteEntry = () => actions(reviewPageMenu(workspacePlace(ws), summary)).find((entry) => entry.id === 'delete')!;
    navigation.openPage(codeReviewPage(summary));

    answerConfirms(false);
    await deleteEntry().run();
    expect(whereTheWindowIs().pages).toEqual([codeReviewPage(summary)]);

    answerConfirms(true);
    await deleteEntry().run();
    expect(whereTheWindowIs().pages).toEqual([]);
  });

  it("offers only what the page doesn't show: a new window, Copy and Delete", () => {
    const ids = reviewPageMenu(workspacePlace(ws), summary)
      .filter((entry) => entry !== SEPARATOR)
      .map((entry) => entry.id);
    expect(ids).toEqual(['reviewInNewWindow', 'copy', 'delete']);
  });
});
