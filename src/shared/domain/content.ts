import type { RevisionRef } from './revision';

/** Where to read a file's contents from. */
export type ContentSource =
  | { kind: 'empty' }
  | { kind: 'workspaceFile'; path: string }
  /** The revision the workspace has loaded for a path, before local changes. */
  | { kind: 'workspaceBase'; path: string }
  /** The text of a workspace file when it was marked as reviewed. */
  | { kind: 'reviewSnapshot'; path: string }
  /** `fileName` is used to recognize images and pick syntax highlighting. */
  | { kind: 'revision'; revision: RevisionRef; fileName: string }
  /**
   * The file at a repository path (`/src/a.ts`) in a changeset or shelve (`cs:12`, `sh:3`), also under an xlink, where
   * a `serverpath:` spec finds nothing.
   */
  | { kind: 'repositoryPath'; path: string; at: string }
  /**
   * Any `cm cat` spec, e.g. `serverpath:/src/a.ts#cs:12`. `fileName` recognizes images when
   * the spec has no path in it (e.g. `itemid:27#cs:12`).
   */
  | { kind: 'spec'; spec: string; fileName?: string };

/** An image's file bytes and type, as read: they cross IPC as binary, and the renderer paints them from a blob URL. */
export interface ImageBytes {
  bytes: Uint8Array;
  mimeType: string;
}

export interface FileContent {
  /** UTF-8 text, when the content is text. */
  text?: string;
  /** The image, when the content is one (an SVG has its `text` too). */
  image?: ImageBytes;
  isBinary: boolean;
  /** Too big to show: text over the diff cap, or an image over the preview cap. */
  tooLarge?: 'text' | 'image';
  size: number;
}
