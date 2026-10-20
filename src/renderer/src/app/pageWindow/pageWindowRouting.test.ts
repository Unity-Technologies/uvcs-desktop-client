import { describe, expect, it } from 'vitest';
import type { Page } from '../navigation/pages';
import { routeInPageWindow } from './pageWindowRouting';

const DIFF: Page = { kind: 'diff', title: 'Changeset 7', target: { kind: 'changeset', changesetId: 7 } };
const HISTORY: Page = { kind: 'history', path: 'src/player.cs' };
const MERGE: Page = { kind: 'merge', request: { kind: 'merge', sourceSpec: 'cs:7' } };

describe('navigating in a page window', () => {
  it('opens the pages it can show within it: a history from its diff, say', () => {
    expect(routeInPageWindow({ kind: 'openPage', page: HISTORY }, [DIFF])).toBe('here');
  });

  it('sends its workspace window what only that one shows: its views, and a merge', () => {
    expect(routeInPageWindow({ kind: 'goToView' }, [DIFF])).toBe('workspaceWindow');
    expect(routeInPageWindow({ kind: 'openPage', page: MERGE }, [DIFF])).toBe('workspaceWindow');
  });

  it('goes back within it, and closes it rather than going back past the page it opened on', () => {
    expect(routeInPageWindow({ kind: 'goBack' }, [DIFF, HISTORY])).toBe('here');
    expect(routeInPageWindow({ kind: 'goBack' }, [DIFF])).toBe('close');
  });
});
