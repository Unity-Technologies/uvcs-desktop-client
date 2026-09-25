import { MousePointerClick } from 'lucide-react';
import { EmptyState } from '../../../ui/EmptyState';
import type { GraphLayout } from '../model/layoutGraph';
import type { GraphSelection } from '../graphSelection';
import { BranchDetails } from './BranchDetails';
import { ChangesetDetails } from './ChangesetDetails';
import styles from './DetailsPanel.module.css';

interface DetailsPanelProps {
  selection: GraphSelection | null;
  layout: GraphLayout;
  workspacePath: string;
  homeChangeset: number | null;
  goToChangeset: (id: number) => void;
  selectBranch: (name: string) => void;
}

export function DetailsPanel({ selection, layout, workspacePath, homeChangeset, goToChangeset, selectBranch }: DetailsPanelProps) {
  const lane = selection?.kind === 'branch' ? layout.lanesByBranch.get(selection.name) : undefined;
  const node = selection?.kind === 'changeset' ? layout.nodes.get(selection.id) : undefined;

  return (
    <aside className={styles.panel}>
      {node ? (
        <ChangesetDetails
          node={node}
          layout={layout}
          workspacePath={workspacePath}
          isHome={node.changeset.id === homeChangeset}
          goToChangeset={goToChangeset}
          selectBranch={selectBranch}
        />
      ) : lane ? (
        <BranchDetails lane={lane} layout={layout} workspacePath={workspacePath} goToChangeset={goToChangeset} selectBranch={selectBranch} />
      ) : (
        <EmptyState
          icon={<MousePointerClick size={22} />}
          title="Nothing selected"
          description="Click a changeset or a branch to see its details. Right-click for actions."
        />
      )}
    </aside>
  );
}
