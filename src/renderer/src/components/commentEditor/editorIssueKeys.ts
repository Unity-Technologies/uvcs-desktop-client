import type { EditorState } from '@codemirror/state';
import { issueKeysOf } from '../issues/issueKeysOf';
import { issueReferences } from './issueReferencesFacet';
import { referencesIn } from './liveMarks';

/**
 * The issues the text being written names, typed or pasted as an address, each once (`issueKeysOf`), as the editor
 * reads its references (`referencesIn`): its chips read them at once (`useIssueReads`), as a comment shown in full
 * does, not only once a card opens. None where the place has no tracker.
 */
export function editorIssueKeys(state: EditorState): string[] {
  if (!state.facet(issueReferences)) return [];
  return issueKeysOf(referencesIn(state, 0, state.doc.length, { revealsSelection: false }).map((found) => found.reference));
}
