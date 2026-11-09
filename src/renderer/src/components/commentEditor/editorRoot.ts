/**
 * The root an editor's focus and selection are read from: the one its parent is in (`getRootNode`). CodeMirror's own
 * guess follows a node's `assignedSlot`, so a field in a thread under a line of the diff (the page's DOM, shown through
 * a slot of Pierre's shadow root) took that shadow root, whose `activeElement` is never the field: `view.hasFocus`
 * stayed false while typing, the Markdown marks were hidden around the caret, and a key typed right after a closing
 * mark (`` ` ``, `*`) landed at the start of the text.
 */
export function editorRootOf(parent: Pick<Node, 'getRootNode'>, page: Document = document): Document | ShadowRoot {
  const root = parent.getRootNode();
  if (root.nodeType === DOCUMENT_NODE || (root.nodeType === DOCUMENT_FRAGMENT_NODE && 'host' in root)) return root as Document | ShadowRoot;
  // A parent not in a document yet has an element of its own as its root, which has no focus to read: the page's.
  return page;
}

// `Node.DOCUMENT_NODE` and `Node.DOCUMENT_FRAGMENT_NODE`, without the DOM's `Node`, which the tests run without.
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
