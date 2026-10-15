import { describe, expect, it } from 'vitest';
import { OwnCopies, ownCopy } from './ownCopy';

// Whether a string is a slice of another isn't observable from JavaScript (only a heap snapshot shows it), so these pin
// what is: a copy keeps the text as it was, whatever its characters.
describe('ownCopy', () => {
  it('keeps the text as it was, whatever its characters', () => {
    for (const text of ['', 'Assets/Models/ship.fbx', 'Assets/tâche/日本/🌿.png', 'a\0b\r\nc']) expect(ownCopy(text)).toBe(text);
  });
});

describe('OwnCopies', () => {
  it('answers each text as it was, one copy per distinct text', () => {
    const copies = new OwnCopies();
    const output = 'game@acme@cloud\ntools@local';
    const [game, tools] = output.split('\n');
    expect([copies.of(game), copies.of(tools), copies.of('game@acme@cloud')]).toEqual(['game@acme@cloud', 'tools@local', 'game@acme@cloud']);
  });
});
