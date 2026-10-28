import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { editorFocus, hasFocus } from './editorFocus';
import { liveMarksOf, type LiveMark } from './liveMarks';
import { BulletWidget, ImageWidget, ReferenceWidget, TableWidget, TaskWidget } from './liveWidgets';
import { tablesIn } from './tableModel';

/* A field without the focus shows its comment as it reads: the decorations, the table field among them (a state field
   sees no view), ask the focus's mirror (`editorFocus`). */
function revealsSelection(state: EditorState): { revealsSelection: boolean } {
  return { revealsSelection: state.field(hasFocus) };
}

const hidden = Decoration.replace({});

/** A mark's decoration (`liveMarksOf` decides; this only draws). */
function decorationOf(mark: LiveMark): Range<Decoration> {
  switch (mark.kind) {
    case 'hidden':
      return hidden.range(mark.from, mark.to);
    case 'reference':
      return Decoration.replace({ widget: new ReferenceWidget(mark.source, mark.reference) }).range(mark.from, mark.to);
    case 'typedReference':
      return Decoration.mark({ class: 'cm-typedReference' }).range(mark.from, mark.to);
    case 'image':
      return Decoration.replace({ widget: new ImageWidget(mark.source, mark.alt, mark.url) }).range(mark.from, mark.to);
    case 'bullet':
      return Decoration.replace({ widget: new BulletWidget() }).range(mark.from, mark.to);
    case 'task':
      return Decoration.replace({ widget: new TaskWidget(mark.checked, mark.box) }).range(mark.from, mark.to);
    case 'link':
      return Decoration.mark({ class: 'cm-linkText' }).range(mark.from, mark.to);
    case 'key':
      return Decoration.mark({ class: 'cm-key' }).range(mark.from, mark.to);
    case 'selected':
      // Inclusive, so it opens before the widget's own replacement at the same place and wraps it.
      return Decoration.mark({ class: 'cm-selectedWidget', inclusive: true }).range(mark.from, mark.to);
    case 'fence':
      return Decoration.mark({ class: 'cm-fence' }).range(mark.from, mark.to);
    case 'line':
      return Decoration.line({ class: `cm-${mark.block}Line` }).range(mark.at);
  }
}

/** The text drawn as it reads, in the editor's visible ranges: redrawn as the text, the selection or the focus move. */
const liveMarks = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = draw(view);
    }

    update(update: ViewUpdate): void {
      const focusMoved = update.startState.field(hasFocus) !== update.state.field(hasFocus);
      if (update.docChanged || update.selectionSet || update.viewportChanged || focusMoved) this.decorations = draw(update.view);
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

function draw(view: EditorView): DecorationSet {
  return Decoration.set(liveMarksOf(view.state, revealsSelection(view.state), view.visibleRanges).map(decorationOf), true);
}

/**
 * Tables drawn whole: a widget replacing whole lines must come from a state field, never a view plugin (CodeMirror
 * takes block decorations only from the state), hence this field beside the plugin.
 */
const liveTables = StateField.define<DecorationSet>({
  create: (state) => tableDecorations(state),
  update: (decorations, transaction) =>
    transaction.docChanged || transaction.selection || transaction.startState.field(hasFocus) !== transaction.state.field(hasFocus) ? tableDecorations(transaction.state) : decorations,
  provide: (field) => EditorView.decorations.from(field),
});

function tableDecorations(state: EditorState): DecorationSet {
  return Decoration.set(
    tablesIn(state, revealsSelection(state)).map((table) => Decoration.replace({ widget: new TableWidget(table), block: true }).range(table.from, table.to)),
    true,
  );
}

/** The comment drawn as it reads around the caret (docs/features/rich-comments.md, "Writing"). */
export function liveDrawing(): Extension {
  return [editorFocus(), liveMarks, liveTables];
}
