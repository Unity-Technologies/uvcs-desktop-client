import { GitGraph } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
import { ViewRefreshButton } from '../../components/ViewRefreshButton';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useWorkspaceUser } from '../../app/account/accounts';
import { ListWithDetails } from '../../components/ListWithDetails';
import { EVERYONE, isEveryone, pickedNames } from '../../lib/peopleFilter';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { NoMatches } from '../../ui/NoMatches';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { openReview } from '../codeReviews/codeReviewOperations';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { GraphCanvas, type GraphHighlights } from './canvas/GraphCanvas';
import type { GraphCanvasHandle } from './canvas/graphCanvasHandle';
import type { GraphTarget } from './canvas/graphTargets';
import { DetailsPanel } from './details/DetailsPanel';
import { openSelection } from './graphActions';
import { handleGraphKey } from './graphKeyboard';
import { graphMenu } from './graphMenu';
import { selectionFor, type GraphSelection } from './graphSelection';
import { GraphFilterBar } from './GraphFilterBar';
import { GraphNavControls } from './GraphNavControls';
import { GraphSearch } from './GraphSearch';
import type { GraphFocus } from './model/filterGraph';
import { rememberedPerHistory } from './model/rememberedPerHistory';
import { describeSelection } from './model/describeSelection';
import { homeTarget } from './model/homeTarget';
import { pendingBranchOf } from './model/pendingChangeset';
import { searchHighlight, type SearchHit } from './model/searchGraph';
import { useBranchExplorerCommands } from './useBranchExplorerCommands';
import { useBranchExplorerData } from './useBranchExplorerData';
import { useCreatedBranchReveal } from './useCreatedBranchReveal';
import { useGraphLayout } from './useGraphLayout';
import { useGraphSearch } from './useGraphSearch';
import { useOpeningView } from './useOpeningView';
import { usePendingChangeset } from './usePendingChangeset';
import { useRevealRequest } from './useRevealRequest';
import styles from './BranchExplorerView.module.css';

const NO_REVIEWS: ReadonlyMap<number, CodeReviewSummary> = new Map();

export function BranchExplorerView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data, isLoading, isFetching, isPlaceholderData, error } = useBranchExplorerData();
  const preferences = useBranchExplorerPreferences();
  const { hideMergedBranches, onlyRelatedToCurrent, visibleBranches, detailsOpen, people, showComments, showAvatars } = preferences;

  const me = useWorkspaceUser();
  const highlightedAuthors = useMemo(() => pickedNames(people, me), [people, me]);
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [focus, setFocus] = useState<GraphFocus | null>(null);
  /** How far the last focus reached; the next one starts there. */
  const [focusHops, setFocusHops] = useState(1);
  const search = useGraphSearch();
  /** Changesets the user expanded out of "+N" nodes. */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const repository = workspace?.repository ?? '';
  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : null;
  const homeChangeset = workspace?.loadedChangeset ?? null;
  // On a label or a changeset, the workspace's changes go on the loaded changeset's branch.
  const pendingBranch = useMemo(() => pendingBranchOf(currentBranch, homeChangeset, data?.changesets), [currentBranch, homeChangeset, data]);
  const { pending, count: pendingChangeCount } = usePendingChangeset(homeChangeset, pendingBranch);

  const { filtered, fullLayout, layout, searchHits } = useGraphLayout({
    data,
    focus,
    currentBranch,
    homeChangeset,
    pending,
    expanded,
    search: search.shown,
    selectedChangeset: selection?.kind === 'changeset' ? selection.id : null,
  });

  const authors = useMemo(() => (data ? rememberedPerHistory(data, 'authors', [], () => authorsOf(data)) : []), [data]);
  const branchNames = useMemo(() => (data ? rememberedPerHistory(data, 'branchNames', [], () => data.branches.map((branch) => branch.name).sort()) : []), [data]);
  // Asked for once the graph is in, so it never waits on the reviews.
  const { data: reviews } = useReviewsByBranch(data !== undefined);
  // What the hits light up, found once per search: selecting and stepping through the hits only moves `active`.
  const searchLit = useMemo(
    () => (search.shown.trim() && fullLayout ? searchHighlight(fullLayout, searchHits, null) : null),
    [search.shown, fullLayout, searchHits],
  );
  const activeHit = searchHits[search.activeHitIndex] ?? null;
  const highlights = useMemo<GraphHighlights>(
    () => ({
      selectedChangeset: selection?.kind === 'changeset' ? selection.id : null,
      selectedBranch: selection?.kind === 'branch' ? selection.name : null,
      selectedPending: selection?.kind === 'pending',
      homeChangeset,
      pendingChangeCount,
      currentBranch,
      highlightedAuthors,
      search: searchLit && { ...searchLit, active: activeHit },
      searchQuery: search.shown.trim(),
      options: { showComments, showAvatars },
      reviews: reviews ?? NO_REVIEWS,
    }),
    [selection, homeChangeset, pendingChangeCount, currentBranch, highlightedAuthors, search.shown, searchLit, activeHit, showComments, showAvatars, reviews],
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
  useOpeningView(layout, home, canvasRef);
  const find = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);
  useBranchExplorerCommands({ goHome, fit, find });

  const frameBranch = (name: string): void => {
    setSelection({ kind: 'branch', name });
    canvasRef.current?.frameBranch(name);
  };
  useRevealRequest({
    layout,
    settled: !isFetching && !isPlaceholderData,
    filtersActive: focus !== null || onlyRelatedToCurrent || hideMergedBranches || visibleBranches !== null || !isEveryone(people),
    clearFilters,
    reveal: (hit) => {
      if (hit.kind === 'branch') return frameBranch(hit.name);
      setSelection({ kind: 'changeset', id: hit.id });
      canvasRef.current?.frameChangeset(hit.id);
    },
  });
  const revealCreatedBranch = useCreatedBranchReveal(layout, frameBranch);

  const goToHit = (hit: SearchHit): void => {
    if (hit.kind === 'branch') {
      setSelection({ kind: 'branch', name: hit.name });
      canvasRef.current?.revealBranch(hit.name);
    } else {
      goToChangeset(hit.kind === 'label' ? hit.changeset : hit.id);
    }
  };

  const stepSearch = (direction: 1 | -1): void => {
    const hit = search.step(direction, fullLayout, searchHits);
    if (hit) goToHit(hit);
  };

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
    if (layout) openSelection(layout, selectionFor(target), repository);
  };

  const onKeyDown = (event: React.KeyboardEvent): void =>
    handleGraphKey(event, {
      layout,
      selection,
      select: setSelection,
      homeChangeset,
      repository,
      canvas: canvasRef,
      goHome,
      find,
      fit,
      zoomBy,
      toggleDetails: () => preferences.set({ detailsOpen: !detailsOpen }),
      exitFocus: () => setFocus(null),
    });

  const header = (
    <ViewHeader
      title="Branch Explorer"
      subtitle={layout && filtered && `${pluralize(filtered.changesets.length, 'changeset')} · ${pluralize(layout.lanes.length, 'branch', 'branches')}`}
      actions={
        <>
          <GraphSearch
            search={search.text}
            onSearchChange={search.change}
            position={search.text.trim() ? { current: search.activeHitIndex + 1, total: searchHits.length } : null}
            onStep={stepSearch}
            inputRef={searchRef}
            onLeave={() => canvasRef.current?.focus()}
          />
          <ViewRefreshButton workspacePath={workspacePath} fetching={isFetching} />
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
