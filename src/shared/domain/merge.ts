export type MergeKind = 'merge' | 'cherryPick' | 'subtractive';

/** What to merge. Everything the merge view needs to preview and run it. */
export interface MergeRequest {
  kind: MergeKind;
  /** Branch, changeset, label or shelve spec, e.g. `br:/main/task`. */
  sourceSpec: string;
  /** For interval merges: the changeset the interval starts after. */
  intervalOriginSpec?: string;
  /** Merge into this branch on the server ("merge to") instead of into the workspace. */
  destinationBranch?: string;
}
