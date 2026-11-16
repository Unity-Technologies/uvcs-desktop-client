import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { cmPlace } from './cmPlace';
import { mergeRequestDestinationArgs, mergeRequestStateArgs } from './mergeRequestArgs';

const IN_WORKSPACE = cmPlace(workspacePlace('/wk/game'));
const ON_REPOSITORY = cmPlace(repositoryPlace('game@local'));

describe('mergeRequestStateArgs', () => {
  it.each(['Draft', 'Open', 'Closed'] as const)('moves the request to %s by the English name cm takes', (state) => {
    expect(mergeRequestStateArgs(43, state, IN_WORKSPACE)).toEqual(['mergerequest', 'edit', '43', `--mergerequeststatus=${state}`]);
  });

  it('names the repository outside a workspace', () => {
    expect(mergeRequestStateArgs(43, 'Closed', ON_REPOSITORY)).toEqual(['mergerequest', 'edit', '43', '--mergerequeststatus=Closed', '--repository=game@local']);
  });
});

describe('mergeRequestDestinationArgs', () => {
  it('names the new destination by its branch spec', () => {
    expect(mergeRequestDestinationArgs(43, '/main/release', IN_WORKSPACE)).toEqual(['mergerequest', 'edit', '43', '--destination=br:/main/release']);
  });

  it('keeps a name with spaces and accents whole, one argument', () => {
    expect(mergeRequestDestinationArgs(43, '/main/versión 2', IN_WORKSPACE)).toEqual(['mergerequest', 'edit', '43', '--destination=br:/main/versión 2']);
  });

  it('names the repository in the spec and the option outside a workspace', () => {
    expect(mergeRequestDestinationArgs(43, '/main', ON_REPOSITORY)).toEqual(['mergerequest', 'edit', '43', '--destination=br:/main@game@local', '--repository=game@local']);
  });
});
