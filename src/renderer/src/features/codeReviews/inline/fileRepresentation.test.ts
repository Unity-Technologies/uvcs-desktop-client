import { describe, expect, it } from 'vitest';
import { representationCommentsOf } from './fileRepresentation';

describe('representationCommentsOf', () => {
  it('asks for the way the thread gone to is on', () => {
    expect(representationCommentsOf({ onText: 2, onImage: 1, focus: { threadId: 4, seq: 7 }, focusedOn: 'image' })).toEqual({ onText: 2, onImage: 1, asked: { representation: 'image', seq: 7 } });
  });

  it('asks for nothing for a thread picked in place, or of another file', () => {
    expect(representationCommentsOf({ onText: 2, onImage: 1, focus: { threadId: 4, seq: 7, inPlace: true }, focusedOn: 'text' }).asked).toBeNull();
    expect(representationCommentsOf({ onText: 2, onImage: 1, focus: { threadId: 4, seq: 7 }, focusedOn: null }).asked).toBeNull();
  });
});
