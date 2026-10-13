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
   * The file at a repository path (`/src/a.ts`) in a changeset, a branch's head or a shelve (`cs:12`, `br:/main`,
   * `sh:3`), also under an xlink, where a `serverpath:` spec finds nothing. `repository` names the xlinked repository
   * when the path is known to be under an xlink: it is read from the point's tree at once (`listsTree`), never by a
   * `serverpath:` that can't find it. It is a flag, not where the revision is read: the tree's `<Repository>` names
   * that (an xlink nested in it, or a sibling under another xlink, hold the file elsewhere), so never read the listed
   * revision as `revid:N@<repository>`.
   */
  | { kind: 'repositoryPath'; path: string; at: string; repository?: string }
  /**
   * Any `cm cat` spec, e.g. `serverpath:/src/a.ts#cs:12`. `fileName` recognizes images when
   * the spec has no path in it (e.g. `itemid:27#cs:12`).
   */
  | { kind: 'spec'; spec: string; fileName?: string };

/** A version kept in the repository, as opposed to a file of the workspace: what Open and Save as take out of it. */
export type RepositoryVersion = Extract<ContentSource, { kind: 'revision' | 'repositoryPath' | 'spec' }>;

/** An image's file bytes and type, as read: they cross IPC as binary, and the renderer paints them from a blob URL. */
export interface ImageBytes {
  bytes: Uint8Array;
  mimeType: string;
}

/** The 3D model formats the diff shows: what Unity projects keep models in, read by their extension. */
export type ModelFormat = 'fbx' | 'obj' | 'gltf' | 'glb';

/** A 3D model's file bytes and format, as read: they cross IPC as binary, and the renderer parses them in a worker. */
export interface ModelBytes {
  bytes: Uint8Array;
  format: ModelFormat;
}

export interface FileContent {
  /** UTF-8 text, when the content is text. */
  text?: string;
  /** The image, when the content is one (an SVG has its `text` too). */
  image?: ImageBytes;
  /** The 3D model, when the content is one (OBJ, `.gltf` and ASCII FBX have their `text` too). */
  model?: ModelBytes;
  isBinary: boolean;
  /** Too big to show: text over the diff cap, or an image or a model over its preview cap. */
  tooLarge?: 'text' | 'image' | 'model';
  size: number;
}
