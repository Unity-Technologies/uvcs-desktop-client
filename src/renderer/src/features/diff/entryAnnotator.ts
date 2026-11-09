import { createContext, type ComponentType, type ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';

/**
 * What a place adds to how a file of a committed diff shows (a review's comments, in its Changes tab: they give the
 * diff its rows through `DiffAnnotationsContext`): controls beside the diff's own.
 */
export interface AnnotatedEntry {
  /** Beside the diff's controls, after them. */
  controls?: ReactNode;
  /**
   * What the diff compares instead of the entry's two revisions: a review comment's own versions, in the changeset that
   * applied it ("See in context"). "Since review" is then off: it compares the entry's.
   */
  compared?: { original: ContentSource; modified: ContentSource };
}

export interface EntryAnnotatorProps {
  target: DiffTarget;
  entry: DiffEntry;
  /** Draws the file's diff with what the annotator decided. */
  children: (annotated: AnnotatedEntry) => ReactNode;
}

/**
 * The component that wraps each file's diff of a `DiffBrowser` where the place adds to it, its hooks reading what it
 * needs; none elsewhere. A component rather than values, so what it reads (a version, its own state) is its own.
 */
export const EntryAnnotatorContext = createContext<ComponentType<EntryAnnotatorProps> | null>(null);
