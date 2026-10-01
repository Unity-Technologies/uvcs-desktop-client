import { describe, expect, it } from 'vitest';
import { incomingNotificationMessage } from './incomingNotificationMessage';

describe('incomingNotificationMessage', () => {
  it('says who checked in what, and where', () => {
    expect(incomingNotificationMessage({ owner: 'ana@unity3d.com', comment: 'Fix boost\n\nThe boost was too strong.' }, '/main/t1', 1)).toBe(
      "Ana checked in 'Fix boost' on t1",
    );
  });

  it('counts the others that came in with it', () => {
    expect(incomingNotificationMessage({ owner: 'ana', comment: 'Fix boost' }, '/main/t1', 3)).toBe("Ana checked in 'Fix boost' on t1 (and 2 more)");
  });

  it('names a deep branch by its own name', () => {
    expect(incomingNotificationMessage({ owner: 'ana', comment: '' }, '/main/child-br-cr-sample/empty-branch2/child_1/subtask', 1)).toBe('Ana checked in on subtask');
  });

  it('leaves out an empty comment', () => {
    expect(incomingNotificationMessage({ owner: 'bob.smith', comment: '' }, '/main', 1)).toBe('Bob Smith checked in on main');
  });
});
