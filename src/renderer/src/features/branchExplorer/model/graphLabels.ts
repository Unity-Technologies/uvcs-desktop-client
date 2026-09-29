import type { GraphLabel } from '@shared/domain/branchExplorer';
import type { LabelInfo } from '@shared/domain/label';
import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from './layoutGraph';

/** A label the graph draws, as the Labels view knows it: its branch is its changeset's, its repository the workspace's. */
export function labelInfo(layout: GraphLayout, label: GraphLabel, repository: string): LabelInfo {
  return { ...label, branch: layout.nodes.get(label.changeset)?.changeset.branch ?? '', repository };
}

/** The label chip selected, if the selection came from one and the graph still draws it. */
export function selectedLabel(layout: GraphLayout, selection: GraphSelection | null, repository: string): LabelInfo | undefined {
  if (selection?.kind !== 'changeset' || selection.label === undefined) return undefined;
  const label = layout.labelsByChangeset.get(selection.id)?.find((drawn) => drawn.name === selection.label);
  return label && labelInfo(layout, label, repository);
}
