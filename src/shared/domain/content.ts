/** Where to read a file's contents from. */
export type ContentSource =
  | { kind: 'empty' }
  | { kind: 'workspaceFile'; path: string }
  /** The revision the workspace has loaded for a path, before local changes. */
  | { kind: 'workspaceBase'; path: string }
  /** `fileName` is used to recognize images and pick syntax highlighting. */
  | { kind: 'revision'; revisionId: number; fileName: string }
  /** Any `cm cat` spec, e.g. `serverpath:/src/a.ts#cs:12`. */
  | { kind: 'spec'; spec: string };

export interface FileContent {
  /** UTF-8 text, when the content is text. */
  text?: string;
  /** Data URL, when the content is an image. */
  imageDataUrl?: string;
  isBinary: boolean;
  size: number;
}
