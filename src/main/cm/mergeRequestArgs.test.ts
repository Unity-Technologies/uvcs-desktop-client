import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { cmPlace } from './cmPlace';
import type { CreateMergeRequestRequest } from '@shared/domain/codeReview';
import { createdMergeRequestOf, createMergeRequestArgs, mergeRequestDestinationArgs, mergeRequestStateArgs } from './mergeRequestArgs';

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

describe('createMergeRequestArgs', () => {
  const request: CreateMergeRequestRequest = { source: '/main/task1', destination: '/main', title: 'Task one', draft: false };

  it('asks to merge the source into the destination, both by branch spec, printing the new id', () => {
    expect(createMergeRequestArgs(request, undefined, IN_WORKSPACE)).toEqual(['mergerequest', 'create', 'br:/main/task1', 'Task one', '--destination=br:/main', '--format={id}']);
  });

  it('creates a draft by the English state name cm takes', () => {
    expect(createMergeRequestArgs({ ...request, draft: true }, undefined, IN_WORKSPACE)).toEqual([
      'mergerequest',
      'create',
      'br:/main/task1',
      'Task one',
      '--destination=br:/main',
      '--mergerequeststatus=Draft',
      '--format={id}',
    ]);
  });

  it('asks users and groups in their own options, in the same command', () => {
    const reviewers = [
      { name: 'ana@example.com', kind: 'user' as const },
      { name: 'Web Devs', kind: 'group' as const },
      { name: 'bob', kind: 'user' as const },
    ];
    expect(createMergeRequestArgs({ ...request, reviewers }, undefined, IN_WORKSPACE)).toEqual([
      'mergerequest',
      'create',
      'br:/main/task1',
      'Task one',
      '--destination=br:/main',
      '--users=ana@example.com,bob',
      '--groups=Web Devs',
      '--format={id}',
    ]);
  });

  it('takes the description from a file: a shell line holds no line breaks', () => {
    expect(createMergeRequestArgs(request, '/tmp/uvcs-1/content.txt', IN_WORKSPACE)).toContain('--descriptionfile=/tmp/uvcs-1/content.txt');
  });

  it('keeps branch names with spaces and accents whole, one argument each', () => {
    expect(createMergeRequestArgs({ ...request, source: '/main/versión 2/tarea uno', destination: '/main/versión 2' }, undefined, IN_WORKSPACE).slice(2, 5)).toEqual([
      'br:/main/versión 2/tarea uno',
      'Task one',
      '--destination=br:/main/versión 2',
    ]);
  });

  it('names the repository in both specs and the option outside a workspace', () => {
    expect(createMergeRequestArgs(request, undefined, ON_REPOSITORY)).toEqual([
      'mergerequest',
      'create',
      'br:/main/task1@game@local',
      'Task one',
      '--destination=br:/main@game@local',
      '--format={id}',
      '--repository=game@local',
    ]);
  });
});

describe('createdMergeRequestOf', () => {
  it('reads the id cm prints alone on its line', () => {
    expect(createdMergeRequestOf('40\n', false)).toEqual({ id: 40, descriptionSaved: true });
    expect(createdMergeRequestOf('40\r\n', false)).toEqual({ id: 40, descriptionSaved: true });
  });

  // `cm` makes the request, then writes its description: when that fails it says so and still prints the id, exiting 1.
  it('reads the id of a request made whose description failed, before or after the error', () => {
    const failure = 'The description of the code review 40 could not be created: Access denied.';
    expect(createdMergeRequestOf(`${failure}\n40\n`, true)).toEqual({ id: 40, descriptionSaved: false });
    expect(createdMergeRequestOf(`40\n${failure}\n`, true)).toEqual({ id: 40, descriptionSaved: false });
  });

  it('finds none when cm printed no id: the request was not made', () => {
    expect(createdMergeRequestOf("The specified branch /main/nope can't be found.\n", true)).toBeUndefined();
    expect(createdMergeRequestOf('', false)).toBeUndefined();
  });
});
