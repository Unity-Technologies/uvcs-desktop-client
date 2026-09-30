import { describe, expect, it, vi } from 'vitest';

// The workspace menu's modules read the platform as they load.
await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());

import type { WorkspaceSummary } from '@shared/domain/workspace';
import { workspaceResults } from './useWorkspaceResults';

const workspace = (name: string): WorkspaceSummary => ({ name, path: `/wk/${name}`, guid: `guid-${name}` });
const [game, tools, docs, current] = [workspace('game'), workspace('tools'), workspace('docs'), workspace('current')];
const all = [game, tools, docs, current];
const names = (results: { label: string }[]) => results.map((result) => result.label);

describe('workspaceResults', () => {
  it('without a search, lists the recent workspaces in the order last used, never the current one', () => {
    const recent = ['/wk/current', '/wk/docs', '/wk/game', '/wk/forgotten'];

    expect(names(workspaceResults(all, recent, '/wk/current', '', () => {}))).toEqual(['docs', 'game']);
  });

  it('with a search, lists every other workspace whose name matches, recent or not', () => {
    expect(names(workspaceResults(all, [], '/wk/current', 'ts', () => {}))).toEqual(['tools']);
    expect(names(workspaceResults(all, [], '/wk/current', 'cur', () => {}))).toEqual([]);
  });

  it('opens the workspace when run', () => {
    const open = vi.fn();

    workspaceResults(all, ['/wk/game'], null, '', open)[0]!.run();

    expect(open).toHaveBeenCalledWith('/wk/game');
  });
});
