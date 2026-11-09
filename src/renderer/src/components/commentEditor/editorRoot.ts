/**
 * The root an editor's focus and selection are read from: the one its parent is in (`getRootNode`). CodeMirror's own
 * guess follows a node's `assignedSlot`, so a field in a thread under a line of the diff (the page's DOM, shown through
 * a slot of Pierre's shadow root) took that shadow root, whose `activeElement` is never the field: `view.hasFocus`
 * stayed false while typing, the Markdown marks were hidden around the caret, and a key typed right after a closing
 * mark (`` ` ``, `*`) landed at the start of the text.
 */
export function editorRootOf(parent: Pick<Node, 'getRootNode'>): Document | ShadowRoot {
  return parent.getRootNode() as Document | ShadowRoot;
}
