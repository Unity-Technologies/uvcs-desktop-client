import { describe, expect, it } from 'vitest';
import type { EditorState } from '@codemirror/state';
import { editorState } from './commentEditorTesting';
import { editorFocused, focusMirrorSpec, hasFocus } from './editorFocus';
import { suggestionGate } from './suggestionTrigger';
import { typingAt } from './typingAt';

/** A field's state as made, the mirror of its focus with it, its caret at the end. */
const field = (text = 'Fixes ') => editorState(text, [hasFocus, typingAt]);

/** Types `text` at the caret, a key at a time, as CodeMirror's input does. */
function type(state: EditorState, text: string): EditorState {
  let typed = state;
  for (const key of text) {
    const at = typed.selection.main.head;
    typed = typed.update({ changes: { from: at, insert: key }, selection: { anchor: at + 1 }, userEvent: 'input.type' }).state;
  }
  return typed;
}

/** The DOM's focus as the window tells the mirror (a focus or blur event, a reconcile). */
function mirror(state: EditorState, domFocused: boolean): EditorState {
  const spec = focusMirrorSpec(state, domFocused);
  return spec ? state.update(spec).state : state;
}

describe('focusMirrorSpec', () => {
  it('sets the mirror to what the DOM says, and changes nothing when they agree', () => {
    const made = field();
    expect(made.field(hasFocus)).toBe(false);
    const focused = mirror(made, true);
    expect(focused.field(hasFocus)).toBe(true);
    expect(focusMirrorSpec(focused, true)).toBeNull();
    expect(mirror(focused, false).field(hasFocus)).toBe(false);
  });

  it('catches up with a focus given before the editor listened, or one whose event never came', () => {
    // The mirror stays false whatever is typed: only the DOM's focus, reconciled, puts it right.
    const typedUnseen = type(field(), 'cs:');
    expect(typedUnseen.field(hasFocus)).toBe(false);
    expect(mirror(typedUnseen, true).field(hasFocus)).toBe(true);
  });
});

describe('editorFocused', () => {
  it('takes the DOM’s focus once the view is there, whatever the mirror says', () => {
    expect(editorFocused(true, false)).toBe(true);
    expect(editorFocused(false, true)).toBe(false);
  });

  it('takes the mirror before the view exists', () => {
    expect(editorFocused(null, true)).toBe(true);
    expect(editorFocused(null, false)).toBe(false);
  });
});

describe('suggestions, as the user writes', () => {
  const shows = (state: EditorState, domFocused: boolean | null) => suggestionGate(state, editorFocused(domFocused, state.field(hasFocus)), null);

  it('show after clicking into the field (or ⇧⌘F from it), the mirror told, and typing `cs:`', () => {
    expect(shows(type(mirror(field(), true), 'cs:'), true)).toMatchObject({ kind: 'changeset' });
  });

  it('show when focus mode was opened by its button on a field never focused, its focus event missed, then `cs:` typed', () => {
    // The field gets the DOM's focus in code as focus mode opens; the mirror never heard of it.
    expect(shows(type(field(), 'cs:'), true)).toMatchObject({ kind: 'changeset' });
  });

  it('show back in a place, its field made again with the same draft, focus mode opened without typing first', () => {
    const remade = field('Fixes cs:12 ');
    expect(shows(type(remade, 'cs:'), true)).toMatchObject({ kind: 'changeset', text: '' });
  });

  it('show after a click inside a box that already had the focus, where no focus event comes', () => {
    const clicked = type(field(), 'cs:').update({ selection: { anchor: 'Fixes cs:'.length } }).state;
    expect(shows(type(clicked, '1'), true)).toMatchObject({ kind: 'changeset', text: '1' });
  });

  it('stay closed in a field without the focus, and once the list was dismissed on the word', () => {
    expect(shows(type(field(), 'cs:'), false)).toBeNull();
    const typed = type(mirror(field(), true), 'cs:');
    expect(suggestionGate(typed, true, 'Fixes '.length)).toBeNull();
  });
});
