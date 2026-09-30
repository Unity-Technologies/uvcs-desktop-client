import { GitGraph, RefreshCw } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useWorkspaceUser } from '../../app/account/accounts';
import { ListWithDetails } from '../../components/ListWithDetails';
import { EVERYONE, isEveryone, pickedNames } from '../../lib/peopleFilter';
import { hotkey, hotkeys, type ShortcutId } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { openReview } from '../codeReviews/codeReviewOperations';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { GraphCanvas, type GraphCanvasHandle, type GraphHighlights } from './canvas/GraphCanvas';
import type { GraphTarget } from './canvas/graphTargets';
import { ZOOM_STEP } from './canvas/zoom';
import { DetailsPanel } from './details/DetailsPanel';
import { graphActions } from './graphActions';
import { graphMenu } from './graphMenu';
import { selectionFor, type GraphSelection } from './graphSelection';
import { GraphFilterBar } from './GraphFilterBar';
import { GraphNavControls } from './GraphNavControls';
import { GraphSearch } from './GraphSearch';
import { filterGraph, type GraphFocus } from './model/filterGraph';
import { layoutGraph, layoutKeeping } from './model/layoutGraph';
import { rememberedPerHistory } from './model/rememberedPerHistory';
import { describeSelection } from './model/describeSelection';
import { selectedLabel } from './model/graphLabels';
import { movedSelection, selectedBranchOf, type GraphMove } from './model/keyboardMoves';
import type { GraphDirection } from './model/navigateGraph';
import { homeTarget } from './model/homeTarget';
import { pendingBranchOf } from './model/pendingChangeset';
import { firstHitIndex, searchGraph, searchHighlight, type SearchHit } from './model/searchGraph';
import { useBranchExplorerCommands } from './useBranchExplorerCommands';
import { useBranchExplorerData } from './useBranchExplorerData';
import { usePendingChangeset } from './usePendingChangeset';
import { useRevealRequest } from './useRevealRequest';
import { useSearchHits } from './useSearchHits';
import styles from './BranchExplorerView.module.css';

const NO_REVIEWS: ReadonlyMap<number, CodeReviewSummary> = new Map();

const openChanges = (): void => navigation.goToView('changes');

const ARROW_DIRECTIONS: Record<string, GraphDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

export function BranchExplorerView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data, isLoading, isFetching, isPlaceholderData, error } = useBranchExplorerData();
  const preferences = useBranchExplorerPreferences();
  const { hideMergedBranches, onlyRelatedToCurrent, visibleBranches, structureOnly, detailsOpen, people, showComments, showAvatars, revealRequest } =
    preferences;

  const me = useWorkspaceUser();
  const highlightedAuthors = useMemo(() => pickedNames(people, me), [people, me]);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [focus, setFocus] = useState<GraphFocus | null>(null);
  /** How far the last focus reached; the next one starts there. */
  const [focusHops, setFocusHops] = useState(1);
  const [search, setSearch] = useState('');
  // The field follows every key at once; the graph finds and lights the hits right after, a key behind at most.
  const shownSearch = useDeferredValue(search);
  /** Changesets the user expanded out of "+N" nodes. */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  /** -1 until the user steps through the matches. */
  const [activeHitIndex, setActiveHitIndex] = useState(-1);

  const repository = workspace?.repository ?? '';
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : null;
  const homeChangeset = workspace?.loadedChangeset ?? null;
  // On a label or a changeset, the workspace's changes go on the loaded changeset's branch.
  const pendingBranch = useMemo(() => pendingBranchOf(currentBranch, homeChangeset, data?.changesets), [currentBranch, homeChangeset, data]);
  const { pending, count: pendingChangeCount } = usePendingChangeset(homeChangeset, pendingBranch);

  // Remembered with the history, so coming back to the view draws at once.
  const filtered = useMemo(() => {
    if (!data) return null;
    const related = focus ?? (onlyRelatedToCurrent && currentBranch ? { branch: currentBranch, hops: 1 } : null);
    return rememberedPerHistory(data, 'filtered', [related?.branch, related?.hops, visibleBranches, hideMergedBranches, currentBranch], () => {
      const chosen = visibleBranches && new Set(visibleBranches);
      return filterGraph(data, { focus: related, visibleBranches: chosen, hideMergedBranches, currentBranch });
    });
  }, [data, focus, onlyRelatedToCurrent, visibleBranches, hideMergedBranches, currentBranch]);

  // Search looks at every changeset, so "Only relevant changesets" can keep what it finds.
  const fullLayout = useMemo(
    () => filtered && rememberedPerHistory(filtered, 'layout', [pending], () => layoutGraph(filtered, undefined, pending)),
    [filtered, pending],
  );
  const searchHits = useSearchHits(fullLayout, shownSearch);
  const selectedChangeset = selection?.kind === 'changeset' ? selection.id : null;
  const structure = useMemo(() => {
    if (!filtered || !structureOnly) return null;
    const keep = new Set(expanded);
    if (homeChangeset !== null) keep.add(homeChangeset);
    for (const link of pending?.mergeLinks ?? []) keep.add(link.sourceChangeset);
    for (const hit of searchHits) if (hit.kind === 'changeset') keep.add(hit.id);
    if (revealRequest?.kind === 'changeset') keep.add(revealRequest.id);
    if (revealRequest?.kind === 'label') keep.add(revealRequest.changeset);
    return { keep, pending, layout: layoutGraph(filtered, { keep }, pending) };
  }, [filtered, structureOnly, expanded, homeChangeset, pending, searchHits, revealRequest]);
  // The selection is kept out of the "+N" nodes too.
  const layout = useMemo(
    () => (filtered && structure ? layoutKeeping(filtered, structure, selectedChangeset) : fullLayout),
    [filtered, structure, selectedChangeset, fullLayout],
  );

  const authors = useMemo(() => (data ? rememberedPerHistory(data, 'authors', [], () => authorsOf(data)) : []), [data]);
  const branchNames = useMemo(() => (data ? rememberedPerHistory(data, 'branchNames', [], () => data.branches.map((branch) => branch.name).sort()) : []), [data]);
  // Asked for once the graph is in, so it never waits on the reviews.
  const { data: reviews } = useReviewsByBranch(data !== undefined);
  // What the hits light up, found once per search: selecting and stepping through the hits only moves `active`.
  const searchLit = useMemo(
    () => (shownSearch.trim() && fullLayout ? searchHighlight(fullLayout, searchHits, null) : null),
    [shownSearch, fullLayout, searchHits],
  );
  const highlights = useMemo<GraphHighlights>(
    () => ({
      selectedChangeset: selection?.kind === 'changeset' ? selection.id : null,
      selectedBranch: selection?.kind === 'branch' ? selection.name : null,
      selectedPending: selection?.kind === 'pending',
      homeChangeset,
      pendingChangeCount,
      currentBranch,
      highlightedAuthors,
      search: searchLit && { ...searchLit, active: searchHits[activeHitIndex] ?? null },
      searchQuery: shownSearch.trim(),
      options: { showComments, showAvatars },
      reviews: reviews ?? NO_REVIEWS,
    }),
    [selection, homeChangeset, pendingChangeCount, currentBranch, highlightedAuthors, shownSearch, searchLit, searchHits, activeHitIndex, showComments, showAvatars, reviews],
  );

  const goToChangeset = useCallback((id: number) => {
    setSelection({ kind: 'changeset', id });
    canvasRef.current?.revealChangeset(id);
  }, []);

  const focusOn = (branch: string, hops: number): void => {
    setFocus({ branch, hops });
    setFocusHops(hops);
  };

  const clearFilters = (): void => {
    setFocus(null);
    preferences.set({ onlyRelatedToCurrent: false, hideMergedBranches: false, visibleBranches: null, people: EVERYONE });
  };

  const home = useMemo(() => layout && homeTarget(layout, homeChangeset, pendingBranch), [layout, homeChangeset, pendingBranch]);
  const goHome = useCallback(() => {
    // The workspace isn't in the graph (older than the dates shown, on a branch filtered out): the newest history.
    if (!home) return canvasRef.current?.showNewest();
    setSelection(home);
    canvasRef.current?.centerOn(home);
  }, [home]);

  const fit = useCallback(() => canvasRef.current?.fit(), []);
  const zoomBy = useCallback((factor: number) => canvasRef.current?.zoomBy(factor), []);
  useInitialFocus(layout, home, canvasRef);
  const find = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);
  useBranchExplorerCommands({ goHome, fit, find });
  useRevealRequest({
    layout,
    settled: !isFetching && !isPlaceholderData,
    filtersActive: focus !== null || onlyRelatedToCurrent || hideMergedBranches || visibleBranches !== null || !isEveryone(people),
    clearFilters,
    reveal: (hit) => {
      if (hit.kind === 'branch') {
        setSelection({ kind: 'branch', name: hit.name });
        canvasRef.current?.frameBranch(hit.name);
      } else {
        setSelection({ kind: 'changeset', id: hit.id });
        canvasRef.current?.frameChangeset(hit.id);
      }
    },
  });

  const stepSearch = (direction: 1 | -1): void => {
    // Enter right after a key, before the graph caught up with it, steps through what is typed.
    const hits = shownSearch === search ? searchHits : fullLayout ? searchGraph(fullLayout, search) : [];
    if (hits.length === 0) return;
    const next = activeHitIndex === -1 ? (direction === 1 ? firstHitIndex(hits, search) : hits.length - 1) : (activeHitIndex + direction + hits.length) % hits.length;
    setActiveHitIndex(next);
    goToHit(hits[next]!);
  };

  const goToHit = (hit: SearchHit): void => {
    if (hit.kind === 'branch') {
      setSelection({ kind: 'branch', name: hit.name });
      canvasRef.current?.revealBranch(hit.name);
    } else {
      goToChangeset(hit.kind === 'label' ? hit.changeset : hit.id);
    }
  };

  const changeSearch = (value: string): void => {
    setSearch(value);
    setActiveHitIndex(-1);
  };

  const revealCreatedBranch = useCreatedBranchReveal(layout, (name) => {
    setSelection({ kind: 'branch', name });
    canvasRef.current?.frameBranch(name);
  });
  const menuFor = (target: GraphTarget | null) =>
    graphMenu(target, {
      workspacePath,
      layout: layout!,
      currentBranch: currentBranch ?? undefined,
      loadedChangeset: workspace?.loadedChangeset,
      repository: workspace?.repository,
      goToChangeset,
      showRelatedTo: (name) => focusOn(name, focusHops),
      revealCreatedBranch,
    });

  const select = (target: GraphTarget | null): void => {
    if (target?.kind === 'codeReview') openReview(target.review);
    else if (target?.kind === 'collapsed') setExpanded((current) => new Set([...current, ...target.node.collapsed!.map((changeset) => changeset.id)]));
    else setSelection(selectionFor(target));
  };

  const activate = (target: GraphTarget): void => {
    const selected = selectionFor(target);
    const label = layout && selectedLabel(layout, selected, repository);
    if (label) graphActions.diffLabel(label);
    else if (selected?.kind === 'changeset') graphActions.diffChangeset(selected.id);
    if (selected?.kind === 'pending') openChanges();
    if (target.kind === 'branch') graphActions.diffBranch(target.lane.branch);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // Keys pressed in a context or details menu (a portal) bubble here too: they belong to the menu.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (!layout || ownsKey(event.target, event.key)) return;
    const selectedId = selection?.kind === 'changeset' ? selection.id : null;
    const label = selectedLabel(layout, selection, repository);
    const branchName = selectedBranchOf(layout, selection);
    const lane = branchName !== null ? layout.lanesByBranch.get(branchName) : undefined;
    // Keyboard moves glide the view along, just enough to keep the selection in sight.
    const move = (graphMove: GraphMove) => (): void => {
      const stop = movedSelection(layout, selection, homeChangeset, graphMove);
      if (stop === null) return;
      setSelection(stop);
      canvasRef.current?.follow(stop);
    };
    const branchEdge = (edge: 'first' | 'last') => (): void => {
      // With nothing selected, Home keeps its old meaning: the workspace changeset.
      if (branchName === null && edge === 'first') goHome();
      else move({ kind: 'branchEdge', edge })();
    };
    // A page keeps a column of the last screen in sight.
    const page = (step: 1 | -1) => (): void => move({ kind: 'page', step, columns: Math.max(1, (canvasRef.current?.columnsOnScreen() ?? 1) - 1) })();

    const bindings: [ShortcutId, () => void][] = [
      ['graphWalk', () => move({ kind: 'walk', direction: ARROW_DIRECTIONS[event.key]! })()],
      ['graphBranchFirst', branchEdge('first')],
      ['graphBranchLast', branchEdge('last')],
      ['graphOldest', move({ kind: 'graphEdge', edge: 'first' })],
      ['graphNewest', move({ kind: 'graphEdge', edge: 'last' })],
      ['graphPageBack', page(-1)],
      ['graphPageForward', page(1)],
      ['graphMergeSource', move({ kind: 'mergeSource' })],
      ['graphMergeDestination', move({ kind: 'mergeDestination' })],
      ['graphBranchBase', move({ kind: 'branchBase' })],
      [
        'graphOpen',
        () => {
          if (label) graphActions.diffLabel(label);
          else if (selectedId !== null) graphActions.diffChangeset(selectedId);
          else if (selection?.kind === 'pending') openChanges();
          else if (lane) graphActions.diffBranch(lane.branch);
        },
      ],
      ['graphOpenBranch', () => lane && graphActions.diffBranch(lane.branch)],
      [
        'graphMerge',
        () => {
          if (selectedId !== null) graphActions.merge('merge', spec.changeset(selectedId));
          else if (selection?.kind === 'branch') graphActions.merge('merge', spec.branch(selection.name));
        },
      ],
      ['graphDetails', () => preferences.set({ detailsOpen: !detailsOpen })],
      [
        'graphContextMenu',
        () => {
          if (label) canvasRef.current?.openContextMenu({ kind: 'label', label, more: [] });
          else if (selectedId !== null) canvasRef.current?.openContextMenu({ kind: 'changeset', id: layout.nodes.get(selectedId)?.changeset.id ?? selectedId });
          else if (selection?.kind === 'branch' && lane) canvasRef.current?.openContextMenu({ kind: 'branch', lane });
        },
      ],
      // ⌘F is the palette command's; the view adds the plain key.
      ['graphFind', find],
      ['graphHome', goHome],
      ['graphZoomIn', () => zoomBy(ZOOM_STEP)],
      ['graphZoomOut', () => zoomBy(1 / ZOOM_STEP)],
      ['graphFit', fit],
      [
        'graphClear',
        () => {
          // Esc steps back: first out of the selection, then out of the focus.
          if (selection) setSelection(null);
          else setFocus(null);
        },
      ],
    ];
    const pressed = (id: ShortcutId): boolean =>
      (id === 'graphContextMenu' && event.key === 'ContextMenu') ||
      hotkeys(id).some((key) => !(id === 'graphFind' && key === hotkey('graphFind')) && matchesShortcut(event.nativeEvent, key));
    const binding = bindings.find(([id]) => pressed(id));
    if (!binding) return;
    event.preventDefault();
    binding[1]();
  };

  const header = (
    <ViewHeader
      title="Branch Explorer"
      subtitle={layout && filtered && `${pluralize(filtered.changesets.length, 'changeset')} · ${pluralize(layout.lanes.length, 'branch', 'branches')}`}
      actions={
        <>
          <GraphSearch
            search={search}
            onSearchChange={changeSearch}
            position={search.trim() ? { current: activeHitIndex + 1, total: searchHits.length } : null}
            onStep={stepSearch}
            inputRef={searchRef}
            onLeave={() => canvasRef.current?.focus()}
          />
          <IconButton
            icon={<RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />}
            label="Refresh"
            onClick={() => void invalidateWorkspace(workspacePath)}
          />
        </>
      }
    >
      <GraphFilterBar
        branches={branchNames}
        authors={authors}
        onZoom={zoomBy}
        onFit={fit}
        onGoHome={goHome}
        focus={focus}
        onFocusHopsChange={(hops) => focus && focusOn(focus.branch, hops)}
        onExitFocus={() => setFocus(null)}
      />
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
  if (layout && layout.columnCount === 0 && data && data.changesets.length > 0) {
    return (
      <>
        {header}
        <NoMatches icon={<GitGraph size={22} />} noun="branches" hint="Check some branches in the Branches filter, or show every branch again." onClear={clearFilters} />
      </>
    );
  }
  if (!layout || layout.columnCount === 0) {
    return (
      <>
        {header}
        <EmptyState icon={<GitGraph size={22} />} title="No history in this range" description="Choose a longer date range to see more changesets." />
      </>
    );
  }

  return (
    <>
      {header}
      <div className={styles.body} onKeyDown={onKeyDown}>
        <div className="visually-hidden" aria-live="polite" aria-atomic="true">
          {describeSelection(layout, selection, homeChangeset)}
        </div>
        <ListWithDetails widthKey="branchExplorer"
          hideDetails={!detailsOpen}
          list={
            <GraphCanvas
              ref={canvasRef}
              layout={layout}
              highlights={highlights}
              onSelect={select}
              onActivate={activate}
              contextMenu={menuFor}
            >
              <GraphNavControls onGoHome={goHome} onFit={fit} onZoom={zoomBy} />
            </GraphCanvas>
          }
          details={
            <DetailsPanel
              selection={selection}
              layout={layout}
              pendingChangeCount={pendingChangeCount}
              menuFor={menuFor}
              goToChangeset={goToChangeset}
              selectBranch={(name) => setSelection({ kind: 'branch', name })}
            />
          }
        />
      </div>
    </>
  );
}

function authorsOf(data: BranchExplorerData): string[] {
  const authors = new Set<string>();
  for (const changeset of data.changesets) authors.add(changeset.owner);
  return [...authors];
}

/** Fields keep every key (the search, an edited comment); buttons and links keep the keys that press them. */
function ownsKey(target: EventTarget, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  return ['BUTTON', 'A'].includes(target.tagName) && (key === 'Enter' || key === ' ');
}

/**
 * A branch created from the graph shows up once the refreshed history has it: then it is revealed, just once. Returns
 * what to call with its name when it is created.
 */
function useCreatedBranchReveal(layout: ReturnType<typeof layoutGraph> | null, reveal: (name: string) => void): (name: string) => void {
  const [pending, setPending] = useState<string | null>(null);
  const latestReveal = useRef(reveal);
  latestReveal.current = reveal;
  useEffect(() => {
    if (pending === null || !layout?.lanesByBranch.has(pending)) return;
    setPending(null);
    latestReveal.current(pending);
  }, [pending, layout]);
  return setPending;
}

/**
 * The first time the graph appears, bring the workspace (where the home badge is: `homeTarget`), or the latest
 * history, into view. Later layouts keep the user's place instead (`keepPlace`).
 */
function useInitialFocus(layout: ReturnType<typeof layoutGraph> | null, home: GraphSelection | null, canvasRef: React.RefObject<GraphCanvasHandle | null>): void {
  const focused = useRef(false);
  useEffect(() => {
    // An empty graph shows no canvas: the next one to show opens anew.
    if (!canvasRef.current) focused.current = false;
    if (focused.current || !layout || layout.columnCount === 0 || !canvasRef.current) return;
    focused.current = true;
    canvasRef.current.showOpeningView(home ?? { kind: 'changeset', id: layout.nodesByColumn.at(-1)!.changeset.id });
  }, [layout, home, canvasRef]);
}
