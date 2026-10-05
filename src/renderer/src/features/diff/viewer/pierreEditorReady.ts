import { areDiffTargetsEqual, type DiffHunksRenderer, type FileDiffMetadata } from '@pierre/diffs';

/**
 * Whether the editor can attach to this diff component without Pierre (1.5.1) highlighting the diff again on the main
 * thread: its renderer has `diff` highlighted in the editor's markup (`editorRenderReady`: the token transformer's
 * `data-char` spans), as Pierre's workers hand it back when they're told to (`useTokenTransformer`). Pierre's edit
 * session reuses that render (`beginEditSession` with the diff it starts from); attached earlier, the session
 * highlights the whole diff on the main thread, 1.6 s for 2 x 190 KB of TypeScript. The renderer is the component's
 * protected `hunksRenderer`; `pierreEditorReady.test.ts` fails when an update moves it. `fileDiff` is the component
 * (`FileDiff`), as `onPostRender` hands it.
 */
export function isReadyToEdit(fileDiff: object, diff: FileDiffMetadata): boolean {
  const renderer = (fileDiff as unknown as { hunksRenderer: DiffHunksRenderer }).hunksRenderer;
  return renderer.editorRenderReady() && areDiffTargetsEqual(renderer.diffCache, diff);
}
