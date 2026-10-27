import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../home/dialogs/CreateWorkspaceDialog', () => ({ openCreateWorkspaceDialog: vi.fn() }));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { singleSelection } from '../../lib/selection';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useNavigation } from '../navigation/navigationStore';
import { selectInView, viewSelectionNow } from '../navigation/viewSelectionStore';
import { createWorkspaceOfExplored } from './createWorkspaceOfExplored';
import { useSession } from './sessionStore';

const DIFF = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } } as const;

afterEach(() => {
  useSession.setState({ place: null, workspacePath: null, leftWorkspacePath: null });
  useNavigation.setState({ view: 'changes', pages: [] });
});

/** Explores game@local on Labels with v0.1 selected and a diff on top, then creates a workspace of it at `/wk/game`. */
function createdFromExploring() {
  useSession.getState().explore('game@acme@cloud');
  useNavigation.setState({ view: 'labels', pages: [DIFF] });
  selectInView(repositoryPlace('game@acme@cloud'), 'labels', 'v0.1');
  fakeApi.answer('settings.rememberRecentWorkspace', () => undefined);
  fakeApi.answer('system.addRecentDocument', () => undefined);

  createWorkspaceOfExplored('game@acme@cloud');
  const options = vi.mocked(openCreateWorkspaceDialog).mock.calls.at(-1)![0];
  options.onCreated('/wk/game');
  return options;
}

describe('creating a workspace of the repository explored', () => {
  it('fixes the repository in the New workspace dialog', () => {
    expect(createdFromExploring().repository).toEqual({ name: 'game', spec: 'game@acme@cloud' });
  });

  it('opens the workspace in this window, on the view and pages it showed, its rows still selected', () => {
    createdFromExploring();

    expect(useSession.getState()).toMatchObject({ place: workspacePlace('/wk/game'), workspacePath: '/wk/game' });
    expect(useNavigation.getState()).toMatchObject({ view: 'labels', pages: [DIFF] });
    expect(viewSelectionNow(workspacePlace('/wk/game'), 'labels')).toEqual(singleSelection('v0.1'));
  });

  it('remembers the workspace as recent', () => {
    createdFromExploring();
    expect(fakeApi.calls()).toContainEqual({ method: 'settings.rememberRecentWorkspace', args: ['/wk/game'] });
  });
});
