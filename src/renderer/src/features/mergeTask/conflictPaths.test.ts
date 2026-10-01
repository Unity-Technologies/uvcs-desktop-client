import { describe, expect, it } from 'vitest';
import { conflictPathCards, resolveButtonLabel } from './conflictPaths';

const TASK = '/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test';
const PARENT = '/main/child-br-cr-sample/empty-branch2/child_1/subtask';

describe('conflictPathCards', () => {
  it('says the workspace switches when it is on neither branch', () => {
    expect(conflictPathCards('/main/task', '/main', '/main/other').map((card) => card.description)).toEqual([
      'Resolve on the task branch (the workspace switches to it), check in, and merge the task again: it will be clean.',
      'Switch to main and merge task there; checking in finishes the task.',
    ]);
  });

  it('says nothing of switching to the branch the workspace is on', () => {
    expect(conflictPathCards('/main/task', '/main', '/main/task')[0]!.description).toBe('Resolve on the task branch, check in, and merge the task again: it will be clean.');
    expect(conflictPathCards('/main/task', '/main', '/main')[1]!.description).toBe('Merge task there; checking in finishes the task.');
  });

  it('names deep branches by their own names, so the cards read at a glance', () => {
    expect(conflictPathCards(TASK, PARENT, '/main').map((card) => [card.title, card.description])).toEqual([
      ['Merge subtask into merge-test first', 'Resolve on the task branch (the workspace switches to it), check in, and merge the task again: it will be clean.'],
      ['Resolve on subtask in this workspace', 'Switch to subtask and merge merge-test there; checking in finishes the task.'],
    ]);
  });
});

describe('resolveButtonLabel', () => {
  it('names what the button does for each way', () => {
    expect(resolveButtonLabel('intoTask', '/main/task', '/main')).toBe('Merge main into task');
    expect(resolveButtonLabel('onDestination', '/main/task', '/main')).toBe('Resolve on main');
  });

  it('names deep branches by their own names, so the button fits the dialog', () => {
    expect(resolveButtonLabel('intoTask', TASK, PARENT)).toBe('Merge subtask into merge-test');
    expect(resolveButtonLabel('onDestination', TASK, PARENT)).toBe('Resolve on subtask');
  });
});
