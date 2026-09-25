export interface AnnotatedLine {
  lineNumber: number;
  content: string;
  /** Changeset where the line was last modified. */
  changesetId: number;
}

/** A changeset that authored at least one line of an annotated file. */
export interface AnnotationChangeset {
  changesetId: number;
  owner: string;
  date: string;
  branch: string;
  comment: string;
  /** Whether the line came from a merge rather than being edited directly. */
  isMerge: boolean;
}

export interface Annotation {
  lines: AnnotatedLine[];
  changesets: AnnotationChangeset[];
}
