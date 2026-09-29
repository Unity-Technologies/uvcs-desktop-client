import { displayName } from '../../../lib/userName';
import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from './layoutGraph';

/** What a screen reader says when the selection moves in the graph, e.g. "Changeset 11, Snappier steering, by Daniel, /main". */
export function describeSelection(layout: GraphLayout, selection: GraphSelection | null, homeChangeset: number | null): string {
  if (selection?.kind === 'branch') return `Branch ${selection.name}`;
  if (selection?.kind === 'pending') return layout.pending ? `Pending changes on ${layout.pending.branch}, the workspace` : '';
  const node = selection && layout.nodes.get(selection.id);
  if (!node) return '';
  const { id, comment, owner, branch } = node.changeset;
  const summary = comment.trim().split('\n', 1)[0] || 'no comment';
  const home = id === homeChangeset ? ', the workspace changeset' : '';
  const subject = selection.label !== undefined ? `Label ${selection.label} on changeset ${id}` : `Changeset ${id}`;
  return `${subject}, ${summary}, by ${displayName(owner)}, ${branch}${home}`;
}
