import { Facet } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { CommentImage } from '../comments/CommentImage';
import { ReferenceChip } from '../comments/ReferenceChip';
import { selectChip } from './chipEditing';
import { toggleTask } from './formatCommands';
import { EditorTable } from './EditorTable';
import type { TableModel } from './tableModel';
import type { WidgetPortals } from './widgetPortals';

/** Where an editor's widgets render their React content. */
export const widgetPortals = Facet.define<WidgetPortals, WidgetPortals | null>({ combine: (values) => values[0] ?? null });

/** Whether chips leave their summary to their card (`ChipHoverCard`): on one line (a summary, a title), where room is short. */
export const compactChips = Facet.define<boolean, boolean>({ combine: (values) => values.some(Boolean) });

/** The portals each widget's element renders into, for its `destroy`, which gets no view. */
const portalsOfHost = new WeakMap<HTMLElement, WidgetPortals>();

/** Renders `node` into `host` through the editor's portals. */
function showIn(view: EditorView, host: HTMLElement, node: React.ReactNode): void {
  const portals = view.state.facet(widgetPortals);
  if (!portals) return;
  portalsOfHost.set(host, portals);
  portals.show(host, node);
}

function removeFrom(host: HTMLElement): void {
  portalsOfHost.get(host)?.remove(host);
  portalsOfHost.delete(host);
}

/** A widget whose content React renders into its element, through the editor's portals. */
abstract class PortalWidget extends WidgetType {
  protected abstract content(view: EditorView): React.ReactNode;
  protected abstract tag(): 'span' | 'div';

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement(this.tag());
    showIn(view, host, this.content(view));
    return host;
  }

  override destroy(dom: HTMLElement): void {
    removeFrom(dom);
  }
}

/**
 * A reference drawn as the shown comment's chip, its click no link: it selects the reference's text, shown as typed,
 * so typing replaces it (`selectChip`).
 */
export class ReferenceWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly reference: CommentReference,
  ) {
    super();
  }

  override eq(other: ReferenceWidget): boolean {
    return other.source === this.source;
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement('span');
    host.className = 'cm-chip';
    selectOnPress(view, host, this.source.length);
    // With its summary, as a shown comment draws it, as soon as the cache holds it (`useCachedObject`); compact on one line.
    showIn(view, host, <ReferenceChip reference={this.reference} source={this.source} compact={view.state.facet(compactChips)} interactive={false} />);
    return host;
  }

  override destroy(dom: HTMLElement): void {
    removeFrom(dom);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** An image drawn as the shown comment's chip: its picture on hover, a click selecting its Markdown as a chip's does. */
export class ImageWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly alt: string,
    readonly url: string,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return other.source === this.source;
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement('span');
    host.className = 'cm-chip';
    selectOnPress(view, host, this.source.length);
    // The chip's own click opens the picture in the browser: in the editor a click selects it instead.
    host.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    showIn(view, host, <CommentImage url={this.url} alt={this.alt} source={this.source} />);
    return host;
  }

  override destroy(dom: HTMLElement): void {
    removeFrom(dom);
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** A press on a chip selects its text, `length` long from where the chip is. */
function selectOnPress(view: EditorView, host: HTMLElement, length: number): void {
  host.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const from = view.posAtDOM(host);
    view.dispatch(selectChip({ from, to: from + length }));
    view.focus();
  });
}

export class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  override toDOM(): HTMLElement {
    const bullet = document.createElement('span');
    bullet.className = 'cm-bullet';
    bullet.textContent = '•';
    bullet.setAttribute('aria-hidden', 'true');
    return bullet;
  }
}

/** A task's box, which a click checks or unchecks in the text (`toggleTask`). */
export class TaskWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly box: number,
  ) {
    super();
  }

  override eq(other: TaskWidget): boolean {
    return other.checked === this.checked && other.box === this.box;
  }

  override toDOM(view: EditorView): HTMLElement {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'cm-task';
    box.checked = this.checked;
    box.tabIndex = -1;
    box.setAttribute('aria-label', this.checked ? 'Done' : 'To do');
    box.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch(toggleTask(view.state, this.box));
    });
    return box;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/** A table drawn as a table while the caret is elsewhere; a click on a cell puts the caret at the end of its text. */
export class TableWidget extends PortalWidget {
  private readonly key: string;

  constructor(readonly table: TableModel) {
    super();
    this.key = JSON.stringify(table);
  }

  override eq(other: TableWidget): boolean {
    return other.key === this.key;
  }

  protected override tag(): 'div' {
    return 'div';
  }

  protected override content(view: EditorView): React.ReactNode {
    return (
      <EditorTable
        table={this.table}
        onCellPressed={(at) => {
          view.dispatch({ selection: { anchor: at }, userEvent: 'select.pointer' });
          view.focus();
        }}
      />
    );
  }

  override ignoreEvent(): boolean {
    return true;
  }
}
