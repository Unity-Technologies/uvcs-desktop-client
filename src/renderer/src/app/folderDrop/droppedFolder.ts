/** One item dropped on the window: its path on disk (empty when it has none, e.g. an image dragged from a browser). */
export interface DroppedItem {
  path: string;
  isDirectory: boolean;
}

/** What a drop brings: one folder to open or make a workspace of, or something that isn't one. */
export type DroppedFolder = { kind: 'folder'; path: string } | { kind: 'notAFolder' } | { kind: 'severalItems' };

/** A drop opens a single folder, as the official client's does; files and several items at once are refused. */
export function readDroppedFolder(items: readonly DroppedItem[]): DroppedFolder {
  if (items.length > 1) return { kind: 'severalItems' };
  const [item] = items;
  if (!item?.isDirectory || !item.path) return { kind: 'notAFolder' };
  return { kind: 'folder', path: item.path };
}

/** The items of a drop event. Read while the event is dispatched: the browser empties `dataTransfer` right after. */
export function droppedItems(dataTransfer: DataTransfer, pathForFile: (file: File) => string): DroppedItem[] {
  return [...dataTransfer.items]
    .filter((item) => item.kind === 'file')
    .map((item) => {
      const file = item.getAsFile();
      return { path: file ? pathForFile(file) : '', isDirectory: item.webkitGetAsEntry()?.isDirectory ?? false };
    });
}
