import { GitGraph, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { useBranchExplorerPreferences } from './branchExplorerStore';
import { GraphCanvas, type GraphCanvasHandle, type GraphHighlights } from './canvas/GraphCanvas';
import type { GraphTarget } from './canvas/graphTargets';
import { DetailsPanel } from './details/DetailsPanel';
import { graphActions } from './graphActions';
import { graphMenu } from './graphMenu';
import { selectionFor, type GraphSelection } from './graphSelection';
import { GraphFilterBar } from './GraphFilterBar';
import { GraphSearch } from './GraphSearch';
import { filterGraph } from './model/filterGraph';
import { layoutGraph } from './model/layoutGraph';
import { neighborChangeset, type GraphDirection } from './model/navigateGraph';
import { searchGraph } from './model/searchGraph';
import { useBranchExplorerCommands } from './useBranchExplorerCommands';
import { useBranchExplorerData } from './useBranchExplorerData';
import styles from './BranchExplorerView.module.css';

const ARROW_DIRECTIONS: Record<string, GraphDirection> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const ZOOM_STEP = 1.25;

export function BranchExplorerView() {
  const workspacePath = useWorkspacePath();
  const { data: workspace } = useWorkspaceInfo();
  const { data, isLoading, isFetching, error } = useBranchExplorerData();
  const { hideMergedBranches, onlyRelatedToCurrent, detailsOpen, highlightedAuthor, showComments, showAvatars } = useBranchExplorerPreferences();

  const canvasRef = useRef<GraphCanvasHandle>(null);
  const [selection, setSelection] = useState<GraphSelection | null>(null);
  const [relatedTo, setRelatedTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  /** -1 until the user steps through the matches. */
  const [activeHitIndex, setActiveHitIndex] = useState(-1);

  const currentBranch = workspace?.selector.kind === 'branch' ? workspace.selector.name : null;
  const homeChangeset = workspace?.loadedChangeset ?? null;

  const layout = useMemo(() => {
    if (!data) return null;
    const focus = relatedTo ?? (onlyRelatedToCurrent ? currentBranch : null);
    return layoutGraph(filterGraph(data, { relatedTo: focus, hideMergedBranches, currentBranch }));
  }, [data, relatedTo, onlyRelatedToCurrent, hideMergedBranches, currentBranch]);

  const searchHits = useMemo(() => (layout ? searchGraph(layout, search) : []), [layout, search]);
  const authors = useMemo(() => [...new Set(data?.changesets.map((changeset) => changeset.owner))].sort(), [data]);
  const highlights = useMemo<GraphHighlights>(
    () => ({
      selectedChangeset: selection?.kind === 'changeset' ? selection.id : null,
      selectedBranch: selection?.kind === 'branch' ? selection.name : null,
      homeChangeset,
      currentBranch,
      highlightedAuthor,
      searchHits: new Set(searchHits),
      activeSearchHit: searchHits[activeHitIndex] ?? null,
      options: { showComments, showAvatars },
    }),
    [selection, homeChangeset, currentBranch, highlightedAuthor, searchHits, activeHitIndex, showComments, showAvatars],
  );

  const goToChangeset = useCallback((id: number) => {
    setSelection({ kind: 'changeset', id });
    canvasRef.current?.revealChangeset(id);
  }, []);

  const goHome = useCallback(() => {
    if (homeChangeset === null) return;
    setSelection({ kind: 'changeset', id: homeChangeset });
    canvasRef.current?.centerOnChangeset(homeChangeset);
  }, [homeChangeset]);

  const fit = useCallback(() => canvasRef.current?.fit(), []);
  useInitialFocus(layout, homeChangeset, canvasRef);
  useBranchExplorerCommands({ goHome, fit });

  const stepSearch = (direction: 1 | -1): void => {
    if (searchHits.length === 0) return;
    const next =
      activeHitIndex === -1 ? (direction === 1 ? 0 : searchHits.length - 1) : (activeHitIndex + direction + searchHits.length) % searchHits.length;
    setActiveHitIndex(next);
    goToChangeset(searchHits[next]!);
  };

  const changeSearch = (value: string): void => {
    setSearch(value);
    setActiveHitIndex(-1);
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
      canvasRef.current?.zoomBy(ZOOM_STEP);
    } else if (event.key === '-') {
      canvasRef.current?.zoomBy(1 / ZOOM_STEP);
    } else if (event.key === '0') {
      fit();
    } else if (event.key === 'Enter' && selection?.kind === 'changeset') {
      graphActions.diffChangeset(selection.id);
    } else if (event.key === 'Escape') {
      setSelection(null);
    }
  };

  const header = (
    <ViewHeader
      title="Branch Explorer"
      subtitle={layout && `${layout.columnCount} changesets · ${layout.lanes.length} branches`}
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
      <GraphFilterBar authors={authors} onZoom={(factor) => canvasRef.current?.zoomBy(factor)} onFit={fit} onGoHome={goHome} />
    </ViewHeader>
  );

  if (isLoading) return <>{header}<CenteredSpinner /></>;
  if (error) return <>{header}<EmptyState title="Couldn't load the history" description={error.message} /></>;
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
      {relatedTo && (
        <div className={styles.focusBanner}>
          Showing branches related to <strong>{relatedTo}</strong>
          <button className={styles.clearFocus} onClick={() => setRelatedTo(null)} aria-label="Show all branches">
            <X size={13} />
          </button>
        </div>
      )}
      <div className={styles.body} onKeyDown={onKeyDown}>
        <GraphCanvas
          ref={canvasRef}
          layout={layout}
          highlights={highlights}
          onSelect={(target) => setSelection(selectionFor(target))}
          onActivate={activate}
          contextMenu={(target) => graphMenu(target, { workspacePath, layout, goToChangeset, showRelatedTo: setRelatedTo })}
        />
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

/** The first time the graph appears, bring the workspace changeset (or the latest history) into view. */
function useInitialFocus(
  layout: ReturnType<typeof layoutGraph> | null,
  homeChangeset: number | null,
  canvasRef: React.RefObject<GraphCanvasHandle | null>,
): void {
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current || !layout || layout.columnCount === 0 || !canvasRef.current) return;
    focused.current = true;
    const target = homeChangeset !== null && layout.nodes.has(homeChangeset) ? homeChangeset : layout.nodesByColumn.at(-1)!.changeset.id;
    canvasRef.current.showOpeningView(target);
  }, [layout, homeChangeset, canvasRef]);
}
