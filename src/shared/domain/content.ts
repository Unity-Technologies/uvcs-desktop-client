/** Where to read a file's contents from. */
export type ContentSource =
  | { kind: 'empty' }
  | { kind: 'workspaceFile'; path: string }
  /** The revision the workspace has loaded for a path, before local changes. */
  | { kind: 'workspaceBase'; path: string }
  /** The text of a workspace file when it was marked as reviewed. */
  | { kind: 'reviewSnapshot'; path: string }
  /** `fileName` is used to recognize images and pick syntax highlighting. */
  | { kind: 'revision'; revisionId: number; fileName: string }
  /**
   * Any `cm cat` spec, e.g. `serverpath:/src/a.ts#cs:12`. `fileName` recognizes images when
   * the spec has no path in it (e.g. `itemid:27#cs:12`).
   */
  | { kind: 'spec'; spec: string; fileName?: string };

export interface FileContent {
  /** UTF-8 text, when the content is text. */
  text?: string;
  /** Data URL, when the content is an image (an SVG has its `text` too). */
  imageDataUrl?: string;
  isBinary: boolean;
  /** Too big to show: text over the diff cap, or an image over the preview cap. */
  tooLarge?: 'text' | 'image';
  size: number;
}
