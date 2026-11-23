import { describe, expect, it } from 'vitest';
import { commentKeyAction, stageClickOf } from './stageCommenting';

const idle = { commenting: false, commentable: true, opened: false };

describe('commentKeyAction', () => {
  it('C starts marking, and stops it while marking', () => {
    expect(commentKeyAction('comment', idle)).toBe('startCommenting');
    expect(commentKeyAction('comment', { ...idle, commenting: true })).toBe('stopCommenting');
  });

  it('C does nothing where the stage takes no comments', () => {
    expect(commentKeyAction('comment', { ...idle, commentable: false })).toBeNull();
  });

  it('Esc stops marking first, then closes the card open', () => {
    expect(commentKeyAction('leaveComment', { ...idle, commenting: true, opened: true })).toBe('stopCommenting');
    expect(commentKeyAction('leaveComment', { ...idle, opened: true })).toBe('closeCard');
  });

  it('Esc goes on with nothing to stop or close', () => {
    expect(commentKeyAction('leaveComment', idle)).toBeNull();
  });
});

describe('stageClickOf', () => {
  it('marks a spot on the version comments are written on while marking', () => {
    expect(stageClickOf(true, 'after')).toEqual({ marks: 'after' });
  });

  it('is the stage’s own click otherwise', () => {
    expect(stageClickOf(false, 'after')).toBe('stage');
    expect(stageClickOf(true, null)).toBe('stage');
  });
});
