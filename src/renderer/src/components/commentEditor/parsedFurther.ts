import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/**
 * Whether more of the comment was parsed between two states. A new state is parsed only up to 3,000 characters within
 * 20 ms (`LanguageState.init` in @codemirror/language) and the view parses the rest later, so in a long comment what's
 * drawn from the parse (code colors, live marks, tables) is drawn again once the parse reaches it. The tree is a new
 * one only when the text changed or the parse moved on: a caret moved or an effect sent keeps it.
 */
export function parsedFurther(startState: EditorState, state: EditorState): boolean {
  return syntaxTree(startState) !== syntaxTree(state);
}
