import { GitGraph, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { GraphCanvas, type GraphCanvasHandle, type GraphHighlights } from './canvas/GraphCanvas';
import type { GraphTarget } from './canvas/graphTargets';
import { ZOOM_STEP } from './canvas/zoom';
import { DetailsPanel } from './details/DetailsPanel';
import { FocusBanner } from './FocusBanner';
import { graphActions } from './graphActions';
import { graphMenu } from './graphMenu';
import { selectionFor, type GraphSelection } from './graphSelection';
import { GraphFilterBar } from './GraphFilterBar';
import { GraphNavControls } from './GraphNavControls';
import { GraphSearch } from './GraphSearch';
import { filterGraph, type GraphFocus } from './model/filterGraph';
import { layoutGraph } from './model/layoutGraph';
import { neighborChangeset, type GraphDirection } from './model/navigateGraph';
import { searchGraph, searchHighlight, type SearchHit } from './model/searchGraph';
import { useBranchExplorerCommands } from './useBranchExplorerCommands';
import { useBranchExplorerData } from './useBranchExplorerData';
import styles from './BranchExplorerView.module.css';

const ARROW_DIRECTIONS: Record<string, GraphDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

export function BranchExplorerView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data, isLoading, isFetching, error } = useBranchExplorerData();
  const preferences = useBranchExplorerPreferences();
  const { hideMergedBranches, onlyRelatedToCurrent, visibleBranches, structureOnly, detailsOpen, highlightedAuthor, showComments, showAvatars } = preferences;

  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [focus, setFocus] = useState<GraphFocus | null>(null);
  /** How far the last focus reached; the next one starts there. */
  const [focusHops, setFocusHops] = useState(1);
  const [search, setSearch] = useState('');
  /** Changesets the user expanded out of "+N" nodes. */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  /** -1 until the user steps through the matches. */
  const [activeHitIndex, setActiveHitIndex] = useState(-1);

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : null;
  const homeChangeset = workspace?.loadedChangeset ?? null;

  const filtered = useMemo(() => {
    if (!data) return null;
    const related = focus ?? (onlyRelatedToCurrent && currentBranch ? { branch: currentBranch, hops: 1 } : null);
    const chosen = visibleBranches && new Set(visibleBranches);
    return filterGraph(data, { focus: related, visibleBranches: chosen, hideMergedBranches, currentBranch });
  }, [data, focus, onlyRelatedToCurrent, visibleBranches, hideMergedBranches, currentBranch]);

  // Search looks at every changeset, so "Only relevant changesets" can keep what it finds.
  const fullLayout = useMemo(() => filtered && layoutGraph(filtered), [filtered]);
  const searchHits = useMemo(() => (fullLayout ? searchGraph(fullLayout, search) : []), [fullLayout, search]);
  const selectedChangeset = selection?.kind === 'changeset' ? selection.id : null;
  const layout = useMemo(() => {
    if (!filtered || !structureOnly) return fullLayout;
    const keep = new Set(expanded);
    if (homeChangeset !== null) keep.add(homeChangeset);
    if (selectedChangeset !== null) keep.add(selectedChangeset);
    for (const hit of searchHits) if (hit.kind === 'changeset') keep.add(hit.id);
    return layoutGraph(filtered, { keep });
  }, [filtered, fullLayout, structureOnly, expanded, homeChangeset, selectedChangeset, searchHits]);

  const authors = useMemo(() => [...new Set(data?.changesets.map((changeset) => changeset.owner))].sort(), [data]);
  const branchNames = useMemo(() => (data?.branches.map((branch) => branch.name) ?? []).sort(), [data]);
  const highlights = useMemo<GraphHighlights>(
    () => ({
      selectedChangeset: selection?.kind === 'changeset' ? selection.id : null,
      selectedBranch: selection?.kind === 'branch' ? selection.name : null,
      homeChangeset,
      currentBranch,
      highlightedAuthor,
      search: search.trim() ? searchHighlight(searchHits, searchHits[activeHitIndex] ?? null) : null,
      options: { showComments, showAvatars },
    }),
    [selection, homeChangeset, currentBranch, highlightedAuthor, search, searchHits, activeHitIndex, showComments, showAvatars],
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
    preferences.set({ onlyRelatedToCurrent: false, hideMergedBranches: false, visibleBranches: null, highlightedAuthor: null });
  };

  const goHome = useCallback(() => {
    if (homeChangeset === null) return;
    setSelection({ kind: 'changeset', id: homeChangeset });
    canvasRef.current?.centerOnChangeset(homeChangeset);
  }, [homeChangeset]);

  const fit = useCallback(() => canvasRef.current?.fit(), []);
  const zoomBy = useCallback((factor: number) => canvasRef.current?.zoomBy(factor), []);
  useInitialFocus(layout, homeChangeset, canvasRef, structureOnly);
  useBranchExplorerCommands({ goHome, fit });

  const stepSearch = (direction: 1 | -1): void => {
    if (searchHits.length === 0) return;
    const next =
      activeHitIndex === -1 ? (direction === 1 ? 0 : searchHits.length - 1) : (activeHitIndex + direction + searchHits.length) % searchHits.length;
    setActiveHitIndex(next);
    goToHit(searchHits[next]!);
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

  const select = (target: GraphTarget | null): void => {
    if (target?.kind === 'collapsed') setExpanded((current) => new Set([...current, ...target.node.collapsed!.map((changeset) => changeset.id)]));
    else setSelection(selectionFor(target));
  };

  const activate = (target: GraphTarget): void => {
    const selected = selectionFor(target);
    if (selected?.kind === 'changeset') graphActions.diffChangeset(selected.id);
    if (selected?.kind === 'branch') graphActions.diffBranch(selected.name);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!layout || event.target instanceof HTMLInputElement) return;
    const direction = ARROW_DIRECTIONS[event.key];
    if (direction && selection?.kind === 'changeset') {
      event.preventDefault();
      const next = neighborChangeset(layout, selection.id, direction);
      if (next !== null) goToChangeset(next);
    } else if (event.key === 'Home' || event.key === 'h') {
      goHome();
    } else if (event.key === '+' || event.key === '=') {
      zoomBy(ZOOM_STEP);
    } else if (event.key === '-') {
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === '0') {
      fit();
    } else if (event.key === 'Enter' && selection?.kind === 'changeset') {
      graphActions.diffChangeset(selection.id);
    } else if (event.key === 'Escape') {
      // Esc steps back: first out of the selection, then out of the focus.
      if (selection) setSelection(null);
      else setFocus(null);
    }
  };

  const header = (
    <ViewHeader
      title="Branch Explorer"
      subtitle={layout && filtered && `${filtered.changesets.length} changesets · ${layout.lanes.length} branches`}
      actions={
        <>
          <GraphSearch
            search={search}
            onSearchChange={changeSearch}
            position={search.trim() ? { current: activeHitIndex + 1, total: searchHits.length } : null}
            onStep={stepSearch}
          />
          <IconButton
            icon={<RefreshCw size={14} className={isFetching ? styles.spinning : undefined} />}
            label="Refresh"
            onClick={() => void invalidateWorkspace(workspacePath)}
          />
        </>
      }
    >
      <GraphFilterBar branches={branchNames} authors={authors} onZoom={zoomBy} onFit={fit} onGoHome={goHome} />
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
  if (layout && layout.columnCount === 0 && data && data.changesets.length > 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<GitGraph size={22} />}
          title="The filters hide every branch"
          description="Check some branches in the Branches filter, or show everything again."
          action={<Button onClick={clearFilters}>Clear filters</Button>}
        />
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
      {focus && <FocusBanner focus={focus} onHopsChange={(hops) => focusOn(focus.branch, hops)} onExit={() => setFocus(null)} />}
      <div className={styles.body} onKeyDown={onKeyDown}>
        <GraphCanvas
          ref={canvasRef}
          layout={layout}
          highlights={highlights}
          onSelect={select}
          onActivate={activate}
          contextMenu={(target) => graphMenu(target, { workspacePath, layout, goToChangeset, showRelatedTo: (name) => focusOn(name, focusHops) })}
        >
          <GraphNavControls onGoHome={goHome} onFit={fit} onZoom={zoomBy} />
        </GraphCanvas>
        {detailsOpen && (
          <DetailsPanel
            selection={selection}
            layout={layout}
            workspacePath={workspacePath}
            homeChangeset={homeChangeset}
            goToChangeset={goToChangeset}
            selectBranch={(name) => setSelection({ kind: 'branch', name })}
          />
        )}
      </div>
    </>
  );
}

/**
 * The first time the graph appears, and whenever "Only relevant changesets" reshapes it, bring the
 * workspace changeset (or the latest history) into view.
 */
function useInitialFocus(
  layout: ReturnType<typeof layoutGraph> | null,
  homeChangeset: number | null,
  canvasRef: React.RefObject<GraphCanvasHandle | null>,
  structureOnly: boolean,
): void {
  const focusedFor = useRef<boolean | null>(null);
  useEffect(() => {
    if (focusedFor.current === structureOnly || !layout || layout.columnCount === 0 || !canvasRef.current) return;
    focusedFor.current = structureOnly;
    const target = homeChangeset !== null && layout.nodes.has(homeChangeset) ? homeChangeset : layout.nodesByColumn.at(-1)!.changeset.id;
    canvasRef.current.showOpeningView(target);
  }, [layout, homeChangeset, canvasRef]);
}
