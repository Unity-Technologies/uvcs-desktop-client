import { Compartment, Facet, type EditorState, type Extension } from '@codemirror/state';
import type { IssueReferenceReader } from '@shared/issueTrackers/issueReferences';

/**
 * The place's issue tracker, which the editor's chips read issues by (`MarkdownOptions.issues`, the shown comment's);
 * none reads no issue. A compartment of its own, as a window's tracker can change while a field shows
 * (`issueTrackersChanged`).
 */
export const issueReferences = Facet.define<IssueReferenceReader | null, IssueReferenceReader | null>({ combine: (values) => values[0] ?? null });

export const issueReferencesCompartment = new Compartment();

export function withIssueReferences(reader: IssueReferenceReader | undefined): Extension {
  return issueReferences.of(reader ?? null);
}

/** Whether the tracker changed between two states: the chips are drawn again. */
export function issueReferencesChanged(before: EditorState, after: EditorState): boolean {
  return before.facet(issueReferences) !== after.facet(issueReferences);
}
