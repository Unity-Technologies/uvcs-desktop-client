import { FileSearch, Folder } from 'lucide-react';
import { useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { placeId } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import type { FocusedLines } from '../../app/navigation/pages';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { folderListScope } from '../../components/collapsedFoldersStore';
import { fileRowKeys } from '../../components/fileRowKeys';
import { MetaDiffButton } from '../../components/MetaDiffButton';
import { useChangeFilter } from '../../components/useChangeFilter';
import { useGroupedFileTree } from '../../components/useGroupedFileTree';
import { isHeaderRow } from '../../lib/groupedPathTree';
import { rangeLength } from '../../lib/itemRange';
import { pluralize } from '../../lib/text';
import { assetOfMeta, diffedItem } from '../../lib/unityMetaPairs';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { ReviewModeButton } from '../review/ReviewModeButton';
import type { DiffBrowserSlots } from './DiffBrowserLayout';
import { DIFF_ENTRY_FACTS, diffEntryTones } from './diffEntrySources';
import { DiffEntryList, diffEntryKey } from './DiffEntryList';
import { diffEntryMenu } from './diffEntryMenu';
import { entryAt, pairedFocus } from './diffFocus';
import { DiffFocusRequestContext } from './diffFocusRequest';
import { pairDiffMetas } from './diffMetaPairs';
import { diffEntryAnnotation } from './diffEntryHistory';
import { navigation } from '../../app/navigation/navigationStore';
import { diffPaneDiffs, diffPaneOf } from './diffPane';
import { useCollapseWithHost } from '../../components/diffExpansionStore';
import { EntryDiff } from './EntryDiff';
import { linkFocusOf, linkFocusOn } from './linkFocus';
import { listedEntries } from './listedEntries';
import { useDiffReview } from './review/useDiffReview';
import { FileStepsContext, selectNow, useFileSteps } from './viewer/fileSteps';
import { LineLinksContext, type LineLinks } from './viewer/lineLinks';
import { useFocusUntilMoved } from './viewer/useFocusUntilMoved';
import { AssetsPointContext, diffAssetsPoint } from './viewer/model/assetsPoints';
import { diffSibling, SiblingFinderContext } from './viewer/model/modelSiblings';
import { publishShownDiffFile } from './shownDiffFile';
import { useDiffMetaShownFor } from './useDiffMetaShownFor';

const NO_ENTRIES: DiffEntry[] = [];

interface DiffBrowserProps {
  target: DiffTarget;
  /** The diff's files; undefined while they're read, when the list holds placeholder rows beside a blank diff. */
  entries: DiffEntry[] | undefined;
  /** The file to open on (by its path, or its old path for a move); the first file when it isn't in the diff. */
  initialPath?: string;
  /** The lines of `initialPath` it opens scrolled to, selected (a link's `#L42`), until another file is selected. */
  initialLines?: FocusedLines;
  /** Where the list and the diff are drawn: a `DiffBrowserLayout`'s, which stays as this is mounted for each target. */
  slots: DiffBrowserSlots;
}

/**
 * A list of changed files next to the diff of the selected one, in one layout from the first frame on: placeholder
 * rows while the files are read, and "No differences" beside an empty list.
 */
export function DiffBrowser({ target, entries: diffEntries, initialPath, initialLines, slots }: DiffBrowserProps) {
  const place = usePlace();
  const reading = diffEntries === undefined;
  const readEntries = diffEntries ?? NO_ENTRIES;
  // A Unity asset's `.meta` rides on its row (`pairDiffMetas`): the list, its counts and its review hold the asset alone.
  const pairs = useMemo(() => pairDiffMetas(listedEntries(readEntries)), [readEntries]);
  const entries = pairs.shown;
  const review = useDiffReview(target, entries);
  const initialFocus = pairedFocus(pairs, initialPath);
  const [selection, setSelection] = useState<SelectionState>(() => (initialFocus.entry ? singleSelection(diffEntryKey(initialFocus.entry)) : EMPTY_SELECTION));
  const focusedAsset = entries.find((entry) => diffEntryKey(entry) === selection.anchor);
  const [metaShownFor, setMetaShownFor] = useDiffMetaShownFor(focusedAsset?.path);
  // Seeded once, from the link that opened the diff (`pairedFocus`); later links mount a new browser.
  const [seededMeta, setSeededMeta] = useState(false);
  if (!seededMeta && initialFocus.metaShownFor !== null && focusedAsset?.path === initialFocus.metaShownFor) {
    setSeededMeta(true);
    setMetaShownFor(initialFocus.metaShownFor);
  }
  const focusedMeta = focusedAsset && pairs.metaOf(focusedAsset);
  // The file whose diff shows: the asset, or its `.meta` while asked for.
  const focused = focusedAsset && diffedItem(focusedAsset, focusedMeta, metaShownFor);
  const showsMeta = focused !== focusedAsset;
  const showMetaOf = (meta: DiffEntry): void => {
    const assetPath = assetOfMeta(meta.path);
    const asset = entries.find((entry) => entry.path === assetPath);
    if (!asset) return;
    setSelection(singleSelection(diffEntryKey(asset)));
    setMetaShownFor(asset.path);
  };
  const firstKey = entries[0] && diffEntryKey(entries[0]);
  const filter = useChangeFilter(entries, diffEntryKey, diffEntryTones, { isViewFilter: true, reading, actions: <ReviewModeButton place={place} /> });
  const shown = useMemo(() => review.narrow(filter.visible), [review.narrow, filter.visible]);
  const clearFilter = (): void => {
    filter.clear();
    review.showAll();
  };
  const content = useMemo(() => ({ sorted: shown }), [shown]);
  const { rows, tree, toggleCollapsed, folding } = useGroupedFileTree(content, entries, diffEntryKey, folderListScope(placeId(place), `diff:${JSON.stringify(target)}`), DIFF_ENTRY_FACTS, selection.anchor);
  const workspaceRepository = usePlaceRepository();
  // A folder or a status group the keyboard (or a click) is on.
  const focusedFolder = focusedAsset ? undefined : rows.filter(isHeaderRow).find((row) => row.key === selection.anchor);
  // The diff's change navigation goes on to the files before and after, as the list shows them.
  const rowKeys = useMemo(() => fileRowKeys(rows), [rows]);
  // A model's companions (a glTF's `.bin`) are entries of the same diff, or the files where it points to.
  const findSibling = useMemo(() => diffSibling(readEntries, target, workspaceRepository), [readEntries, target, workspaceRepository]);
  // A model's materials and textures are the ones where the diff points to, the side before with its changes undone.
  const findAssetsPoint = useMemo(() => diffAssetsPoint(readEntries, target), [readEntries, target]);
  const fileSteps = useFileSteps({ keys: rowKeys, current: selection.anchor, select: (key, selected) => selectNow(selected, () => setSelection(singleSelection(key))), pathOf: (key) => key });

  // The file asked for once the files are read, else the first, before the list paints: something is always selected
  // for the diff pane. A selected file the diff no longer holds (read again after a check-in) gives way the same.
  useLayoutEffect(() => {
    if (focusedAsset || focusedFolder || !firstKey) return;
    const initial = pairedFocus(pairs, initialPath).entry;
    setSelection(singleSelection(initial ? diffEntryKey(initial) : firstKey));
  }, [focusedAsset, focusedFolder, firstKey]);

  // The place asks for a file again (a review's Comments panel going to a thread): select it, where the diff has it.
  const focusRequest = useContext(DiffFocusRequestContext);
  useEffect(() => {
    const requested = focusRequest && entryAt(entries, focusRequest.path);
    if (requested) setSelection(singleSelection(diffEntryKey(requested)));
  }, [focusRequest?.seq, reading]);

  // The lines a link opened the diff on go once another file is selected: coming back leaves the file where it was.
  const linkFocus = useFocusUntilMoved(linkFocusOf(initialPath, initialLines), focused?.path);
  const focusOnShown = linkFocusOn(linkFocus, focused);
  // The lines' menu annotates the file at them as the diff's newer side has it (`diffEntryAnnotation`), where it can.
  const annotation = focused ? diffEntryAnnotation(target, focused) : null;
  // Keyed by the file shown, not `annotation` or `target`, which are new objects each render: the diff is mounted per
  // target (`TargetDiff`), so a file's path names its annotation.
  const lineLinks = useMemo<LineLinks>(
    () => ({ focus: focusOnShown, publishes: true, annotateAt: annotation ? (lines) => navigation.openPage({ ...annotation, focusLines: lines }) : undefined }),
    [linkFocus, focused?.path, annotation === null],
  );

  const pane = diffPaneOf({ listedCount: reading ? undefined : entries.length, shownCount: shown.length, entrySelected: focusedAsset !== undefined, folderSelected: focusedFolder !== undefined });
  useCollapseWithHost(diffPaneDiffs(pane));

  // By what the target is, not the object: a branch diff passes a new one each render, and leaving the file on screen
  // (the cleanup) would say no file shows between two renders. Published by value too (`publishShownDiffFile`).
  const targetKey = JSON.stringify(target);
  useEffect(() => {
    if (!focused) return;
    publishShownDiffFile({ target, path: focused.path });
    return () => publishShownDiffFile(null);
  }, [targetKey, focused?.path]);

  return (
    <>
      {createPortal(
        <DiffEntryList
          rows={rows}
          tree={tree}
          toggleCollapsed={toggleCollapsed}
          folding={folding}
          query={filter.query}
          filterBar={filter.bar}
          selection={selection}
          onSelectionChange={setSelection}
          contextMenu={(selected) =>
            diffEntryMenu(place, target, selected, { review, workspaceRepository, diffEntries: readEntries, metaOf: pairs.metaOf, onMetaDiff: showMetaOf })
          }
          metaOf={pairs.metaOf}
          review={review}
          loading={reading}
          noMatches={pane === 'noMatches' && <NoMatches noun="files" onClear={clearFilter} />}
        />,
        slots.files,
      )}
      {createPortal(
        pane === 'noDifferences' ? (
          <EmptyState icon={<FileSearch size={22} />} title="No differences" description="There are no file changes to show." />
        ) : pane === 'entry' && focused ? (
          <FileStepsContext.Provider value={fileSteps}>
            <SiblingFinderContext.Provider value={findSibling}>
              <AssetsPointContext.Provider value={findAssetsPoint}>
                <LineLinksContext.Provider value={lineLinks}>
                  <EntryDiff
                    place={place}
                    target={target}
                    entry={focused}
                    entries={entries}
                    onOpen={(entry) => setSelection(singleSelection(diffEntryKey(entry)))}
                    reviewMarks={review.marks}
                    showsMeta={showsMeta}
                    metaToggle={focusedMeta && <MetaDiffButton pressed={showsMeta} onChange={(pressed) => setMetaShownFor(pressed ? focusedAsset!.path : null)} />}
                  />
                </LineLinksContext.Provider>
              </AssetsPointContext.Provider>
            </SiblingFinderContext.Provider>
          </FileStepsContext.Provider>
        ) : pane === 'folder' && focusedFolder ? (
          <EmptyState icon={<Folder size={24} />} title={focusedFolder.type === 'group' ? focusedFolder.label : focusedFolder.path} description={`${pluralize(rangeLength(focusedFolder.held), 'change')}. Select a file to see its diff.`} />
        ) : null,
        slots.diff,
      )}
    </>
  );
}
