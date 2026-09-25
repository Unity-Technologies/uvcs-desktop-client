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
import { AttributesView } from '../../features/attributes/AttributesView';
import { BranchExplorerView } from '../../features/branchExplorer/BranchExplorerView';
import { BranchesView } from '../../features/branches/BranchesView';
import { ChangesetsView } from '../../features/changesets/ChangesetsView';
import { CodeReviewsView } from '../../features/codeReviews/CodeReviewsView';
import { FilesView } from '../../features/files/FilesView';
import { IncomingChangesView } from '../../features/incoming/IncomingChangesView';
import { useIncomingChangesCount } from '../../features/incoming/useIncomingChangesCount';
import { LabelsView } from '../../features/labels/LabelsView';
import { LocksView } from '../../features/locks/LocksView';
import { PendingChangesView } from '../../features/pendingChanges/PendingChangesView';
import { usePendingChangesCount } from '../../features/pendingChanges/usePendingChanges';
import { ShelvesView } from '../../features/shelves/ShelvesView';
import { SyncView } from '../../features/sync/SyncView';
import type { Icon } from '../../lib/actions';
import type { ViewId } from './views';

export interface ViewDefinition {
  id: ViewId;
  label: string;
  icon: Icon;
  group: 'Workspace' | 'History' | 'Collaborate';
  shortcut?: string;
  component: ComponentType;
  /** A hook returning a count to show next to the view in the sidebar. */
  useBadge?: () => number | undefined;
}

export const VIEWS: ViewDefinition[] = [
  { id: 'changes', label: 'Changes', icon: FileDiff, group: 'Workspace', shortcut: 'mod+1', component: PendingChangesView, useBadge: usePendingChangesCount },
  { id: 'incoming', label: 'Incoming', icon: ArrowDownToLine, group: 'Workspace', component: IncomingChangesView, useBadge: useIncomingChangesCount },
  { id: 'files', label: 'Files', icon: FolderTree, group: 'Workspace', shortcut: 'mod+2', component: FilesView },
  { id: 'branchExplorer', label: 'Branch Explorer', icon: GitGraph, group: 'History', shortcut: 'mod+3', component: BranchExplorerView },
  { id: 'changesets', label: 'Changesets', icon: GitCommitVertical, group: 'History', shortcut: 'mod+4', component: ChangesetsView },
  { id: 'branches', label: 'Branches', icon: GitBranch, group: 'History', shortcut: 'mod+5', component: BranchesView },
  { id: 'labels', label: 'Labels', icon: Tag, group: 'History', shortcut: 'mod+6', component: LabelsView },
  { id: 'shelves', label: 'Shelves', icon: Archive, group: 'History', shortcut: 'mod+7', component: ShelvesView },
  { id: 'attributes', label: 'Attributes', icon: Tags, group: 'History', component: AttributesView },
  { id: 'codeReviews', label: 'Code reviews', icon: MessageSquareCode, group: 'Collaborate', shortcut: 'mod+8', component: CodeReviewsView },
  { id: 'locks', label: 'Locks', icon: Lock, group: 'Collaborate', component: LocksView },
  { id: 'sync', label: 'Sync', icon: RefreshCcw, group: 'Collaborate', shortcut: 'mod+9', component: SyncView },
];

export function viewDefinition(id: ViewId): ViewDefinition {
  return VIEWS.find((view) => view.id === id)!;
}
