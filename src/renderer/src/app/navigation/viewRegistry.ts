import {
  Archive,
  ArrowDownToLine,
  FileDiff,
  FolderTree,
  GitBranch,
  GitCommitVertical,
  GitGraph,
  Lock,
  MessageSquareCode,
  RefreshCcw,
  Tag,
  Tags,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useIncomingChangesBadge } from '../../features/incoming/useIncomingChangesBadge';
import { useLeftChangesSummary } from '../../features/leftChanges/useLeftChanges';
import { AttributesView } from '../../features/attributes/AttributesView';
import { BranchExplorerView } from '../../features/branchExplorer/BranchExplorerView';
import { BranchesView } from '../../features/branches/BranchesView';
import { ChangesetsView } from '../../features/changesets/ChangesetsView';
import { CodeReviewsView } from '../../features/codeReviews/CodeReviewsView';
import { FilesView } from '../../features/files/FilesView';
import { IncomingChangesView } from '../../features/incoming/IncomingChangesView';
import { LabelsView } from '../../features/labels/LabelsView';
import { LocksView } from '../../features/locks/LocksView';
import { ShelvesView } from '../../features/shelves/ShelvesView';
import { SyncView } from '../../features/sync/SyncView';
import { PendingChangesView } from '../../features/pendingChanges/PendingChangesView';
import { usePendingChangesBadge } from '../../features/pendingChanges/usePendingChanges';
import type { Icon } from '../../lib/actions';
import type { NavBadge } from '../../ui/nav/navBadgeText';
import { isMac } from '../../lib/platform';
import { viewShortcut } from '../../lib/shortcutRegistry';
import type { ViewId } from './views';

// Every view is in the startup bundle: its first frame is its own loading state (its header, its filters, its skeleton),
// never a generic fallback that it then replaces. What is heavy beneath them loads on first use instead, in a pane
// already laid out (`startupBundle.test.ts` keeps the heavy libraries out).

export interface ViewDefinition {
  id: ViewId;
  label: string;
  icon: Icon;
  group: 'Workspace' | 'History' | 'Collaborate';
  /** ⌘1, ⌘2… in sidebar order (`viewShortcut`). */
  shortcut: string;
  component: ComponentType;
  /** A hook returning a count to show next to the view in the sidebar. */
  useBadge?: () => NavBadge | undefined;
  /** A hook saying what waits in the view, shown as a dot with those words; undefined when nothing waits. */
  useDot?: () => string | undefined;
}

const SIDEBAR_VIEWS: Omit<ViewDefinition, 'shortcut'>[] = [
  { id: 'changes', label: 'Changes', icon: FileDiff, group: 'Workspace', component: PendingChangesView, useBadge: usePendingChangesBadge, useDot: useLeftChangesSummary },
  { id: 'incoming', label: 'Incoming', icon: ArrowDownToLine, group: 'Workspace', component: IncomingChangesView, useBadge: useIncomingChangesBadge },
  { id: 'files', label: 'Files', icon: FolderTree, group: 'Workspace', component: FilesView },
  { id: 'branchExplorer', label: 'Branch Explorer', icon: GitGraph, group: 'History', component: BranchExplorerView },
  { id: 'changesets', label: 'Changesets', icon: GitCommitVertical, group: 'History', component: ChangesetsView },
  { id: 'branches', label: 'Branches', icon: GitBranch, group: 'History', component: BranchesView },
  { id: 'labels', label: 'Labels', icon: Tag, group: 'History', component: LabelsView },
  { id: 'shelves', label: 'Shelves', icon: Archive, group: 'History', component: ShelvesView },
  { id: 'attributes', label: 'Attributes', icon: Tags, group: 'History', component: AttributesView },
  { id: 'codeReviews', label: 'Code reviews', icon: MessageSquareCode, group: 'Collaborate', component: CodeReviewsView },
  { id: 'locks', label: 'Locks', icon: Lock, group: 'Collaborate', component: LocksView },
  { id: 'sync', label: 'Sync', icon: RefreshCcw, group: 'Collaborate', component: SyncView },
];

/** In sidebar order: the sidebar lists them group by group, in this order. */
export const VIEWS: ViewDefinition[] = SIDEBAR_VIEWS.map((view, position) => ({ ...view, shortcut: viewShortcut(position, isMac) }));

export function viewDefinition(id: ViewId): ViewDefinition {
  return VIEWS.find((view) => view.id === id)!;
}
