import { describe, expect, it } from 'vitest';
import { conflictPathCards, resolveButtonLabel } from './conflictPaths';

describe('conflictPathCards', () => {
  it('says the workspace switches when it is on neither branch', () => {
    expect(conflictPathCards('/main/task', '/main', '/main/other').map((card) => card.description)).toEqual([
      'Resolve on the task branch (the workspace switches to it), check in, and merge the task again: it will be clean.',
      'Switch to /main and merge /main/task there; checking in finishes the task.',
    ]);
  });

  it('says nothing of switching to the branch the workspace is on', () => {
    expect(conflictPathCards('/main/task', '/main', '/main/task')[0]!.description).toBe('Resolve on the task branch, check in, and merge the task again: it will be clean.');
    expect(conflictPathCards('/main/task', '/main', '/main')[1]!.description).toBe('Merge /main/task there; checking in finishes the task.');
  });
});

describe('resolveButtonLabel', () => {
  it('names what the button does for each way', () => {
    expect(resolveButtonLabel('intoTask', '/main/task', '/main')).toBe('Merge /main into /main/task');
    expect(resolveButtonLabel('onDestination', '/main/task', '/main')).toBe('Resolve on /main');
  });
});
