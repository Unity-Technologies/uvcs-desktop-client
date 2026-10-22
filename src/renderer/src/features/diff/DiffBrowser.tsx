import { FileSearch, Folder } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { FocusedLines } from '../../app/navigation/pages';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useFileTree } from '../../components/useFileTree';
import type { TreeFolderRow } from '../../lib/pathTree';
import { pluralize } from '../../lib/text';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { SplitPane } from '../../ui/SplitPane';
import { ReviewModeButton } from '../review/ReviewModeButton';
import { diffEntryTones } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';
import { entryToFocus } from './diffFocus';
import { diffPaneOf } from './diffPane';
import { EntryDiff } from './EntryDiff';
import { linkFocusOf, linkFocusOn } from './linkFocus';
import { listedEntries } from './listedEntries';
import { useDiffReview } from './review/useDiffReview';
import { FileStepsContext, useFileSteps } from './viewer/fileSteps';
import { LineLinksContext, type LineLinks } from './viewer/lineLinks';
import { AssetsPointContext, diffAssetsPoint } from './viewer/model/assetsPoints';
import { diffSibling, SiblingFinderContext } from './viewer/model/modelSiblings';
import { useShownDiffFile } from './shownDiffFile';

const NO_ENTRIES: DiffEntry[] = [];

interface DiffBrowserProps {
  target: DiffTarget;
  /** The diff's files; undefined while they're read, when the list holds placeholder rows beside a blank diff. */
  entries: DiffEntry[] | undefined;
  /** The file to open on (by its path, or its old path for a move); the first file when it isn't in the diff. */
  initialPath?: string;
  /** The lines of `initialPath` it opens scrolled to, selected (a link's `#L42`), until another file is selected. */
  initialLines?: FocusedLines;
}

/**
 * A list of changed files next to the diff of the selected one, in one layout from the first frame on: placeholder
 * rows while the files are read, and "No differences" beside an empty list.
 */
export function DiffBrowser({ target, entries: diffEntries, initialPath, initialLines }: DiffBrowserProps) {
  const workspacePath = useWorkspacePath();
  const reading = diffEntries === undefined;
  const readEntries = diffEntries ?? NO_ENTRIES;
  const entries = useMemo(() => listedEntries(readEntries), [readEntries]);
  const review = useDiffReview(target, entries);
  const [selection, setSelection] = useState<SelectionState>(() => {
    const initial = entryToFocus(entries, initialPath);
    return initial ? singleSelection(diffEntryKey(initial)) : EMPTY_SELECTION;
  });
  const focused = entries.find((entry) => diffEntryKey(entry) === selection.anchor);
  const firstKey = entries[0] && diffEntryKey(entries[0]);
  const filter = useChangeFilter(entries, diffEntryKey, diffEntryTones, { isViewFilter: true, reading, actions: <ReviewModeButton workspacePath={workspacePath} /> });
  const shown = useMemo(() => review.narrow(filter.visible), [review.narrow, filter.visible]);
  const clearFilter = (): void => {
    filter.clear();
    review.showAll();
  };
  const { rows, tree, toggleCollapsed } = useFileTree(shown, diffEntryKey, folderListScope(workspacePath, `diff:${JSON.stringify(target)}`), selection.anchor);
  const workspaceRepository = useWorkspaceInfo().data?.repository;
  // A folder the keyboard (or a click) is on, in a tree.
  const focusedFolder = focused ? undefined : rows.find((row): row is TreeFolderRow<DiffEntry> => row.type === 'folder' && row.key === selection.anchor);
  // The diff's change navigation goes on to the files before and after, as the list shows them.
  const rowKeys = useMemo(() => rows.flatMap((row) => (row.type === 'file' && row.item.itemType !== 'directory' ? [row.key] : [])), [rows]);
  // A model's companions (a glTF's `.bin`) are entries of the same diff, or the files where it points to.
  const findSibling = useMemo(() => diffSibling(readEntries, target, workspaceRepository), [readEntries, target, workspaceRepository]);
  // A model's materials and textures are the ones where the diff points to, the side before with its changes undone.
  const findAssetsPoint = useMemo(() => diffAssetsPoint(readEntries, target), [readEntries, target]);
  const fileSteps = useFileSteps({ keys: rowKeys, current: selection.anchor, select: (key) => setSelection(singleSelection(key)), pathOf: (key) => key });

  // The file asked for once the files are read, else the first, before the list paints: something is always selected
  // for the diff pane. A selected file the diff no longer holds (read again after a check-in) gives way the same.
  useLayoutEffect(() => {
    if (focused || focusedFolder || !firstKey) return;
    const initial = entryToFocus(entries, initialPath);
    setSelection(singleSelection(initial ? diffEntryKey(initial) : firstKey));
  }, [focused, focusedFolder, firstKey]);

  // The lines a link opened the diff on go once another file is selected: coming back leaves the file where it was.
  const [linkFocus, setLinkFocus] = useState(() => linkFocusOf(initialPath, initialLines));
  const focusOnShown = linkFocusOn(linkFocus, focused);
  useEffect(() => {
    if (linkFocus && focused && !focusOnShown) setLinkFocus(null);
  }, [focused?.path]);
  const lineLinks = useMemo<LineLinks>(() => ({ focus: focusOnShown, publishes: true }), [linkFocus, focused?.path]);

  const pane = diffPaneOf({ listedCount: reading ? undefined : entries.length, shownCount: shown.length, entrySelected: focused !== undefined, folderSelected: focusedFolder !== undefined });

  useEffect(() => {
    if (!focused) return;
    useShownDiffFile.setState({ shown: { target, path: focused.path } });
    return () => useShownDiffFile.setState({ shown: null });
  }, [target, focused?.path]);

  return (
    <SplitPane
      initialSize={340}
      minSize={220}
      maxSize={640}
      first={
        <DiffEntryList
          rows={rows}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          query={filter.query}
          filterBar={filter.bar}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(selected) => diffEntryMenu(workspacePath, target, selected, { review, workspaceRepository, diffEntries: readEntries })}
          review={review}
          loading={reading}
          noMatches={pane === 'noMatches' && <NoMatches noun="files" onClear={clearFilter} />}
        />
      }
      second={
        pane === 'noDifferences' ? (
          <EmptyState icon={<FileSearch size={22} />} title="No differences" description="There are no file changes to show." />
        ) : pane === 'entry' && focused ? (
          <FileStepsContext.Provider value={fileSteps}>
            <SiblingFinderContext.Provider value={findSibling}>
              <AssetsPointContext.Provider value={findAssetsPoint}>
                <LineLinksContext.Provider value={lineLinks}>
                  <EntryDiff workspacePath={workspacePath} entry={focused} reviewMarks={review.marks} />
                </LineLinksContext.Provider>
              </AssetsPointContext.Provider>
            </SiblingFinderContext.Provider>
          </FileStepsContext.Provider>
        ) : pane === 'folder' && focusedFolder ? (
          <EmptyState icon={<Folder size={24} />} title={focusedFolder.path} description={`${pluralize(focusedFolder.items.length, 'change')}. Select a file to see its diff.`} />
        ) : null
      }
    />
  );
}
