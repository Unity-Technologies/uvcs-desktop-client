import type { ObjectLinks } from '../../../components/objectLinks';
import { NoSelection } from '../../../components/NoSelection';
import type { MenuEntry } from '../../../lib/actions';
import { DetailsLink } from '../../../ui/DetailsPanel';
import type { GraphTarget } from '../canvas/graphTargets';
import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from '../model/layoutGraph';
import { BranchDetails } from './BranchDetails';
import { BranchName } from './BranchName';
import { ChangesetDetails } from './ChangesetDetails';
import { PendingDetails } from './PendingDetails';

interface DetailsPanelProps {
  selection: GraphSelection | null;
  layout: GraphLayout;
  /** What the pending changes count, when they are selected. */
  pendingChangeCount: number;
  /** The graph's context menu for a target, offered behind "More actions". */
  menuFor: (target: GraphTarget) => MenuEntry[];
  goToChangeset: (id: number) => void;
  selectBranch: (name: string) => void;
}

export function DetailsPanel({ selection, layout, pendingChangeCount, menuFor, goToChangeset, selectBranch }: DetailsPanelProps) {
  const lane = selection?.kind === 'branch' ? layout.lanesByBranch.get(selection.name) : undefined;
  const node = selection?.kind === 'changeset' ? layout.nodes.get(selection.id) : undefined;
  const pending = selection?.kind === 'pending' ? layout.pending : null;
  const links: ObjectLinks = {
    changeset: (id) => (layout.nodes.has(id) ? <DetailsLink onClick={() => goToChangeset(id)}>Changeset {id}</DetailsLink> : `Changeset ${id}`),
    branch: (name) => <BranchName name={name} onClick={() => selectBranch(name)} />,
    selectBranch,
  };

  if (node) {
    return <ChangesetDetails key={node.changeset.id} node={node} layout={layout} menu={menuFor({ kind: 'changeset', id: node.changeset.id })} links={links} />;
  }
  if (pending) return <PendingDetails pending={pending} count={pendingChangeCount} links={links} />;
  if (lane) {
    return <BranchDetails key={lane.branch.name} lane={lane} layout={layout} menu={menuFor({ kind: 'branch', lane })} links={links} />;
  }
  return <NoSelection noun="changeset or branch" />;
}
