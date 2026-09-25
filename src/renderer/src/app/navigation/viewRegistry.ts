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
import { useIncomingChangesCount } from '../../features/incoming/useIncomingChangesCount';
import { useHasLeftChanges } from '../../features/leftChanges/useLeftChanges';
import { usePendingChangesCount } from '../../features/pendingChanges/usePendingChanges';
import type { Icon } from '../../lib/actions';
import { lazyComponent } from '../../lib/lazyComponent';
import type { ViewId } from './views';

// Views load on first visit so the app starts fast.
const AttributesView = lazyComponent(() => import('../../features/attributes/AttributesView').then((module) => module.AttributesView));
const BranchExplorerView = lazyComponent(() => import('../../features/branchExplorer/BranchExplorerView').then((module) => module.BranchExplorerView));
const BranchesView = lazyComponent(() => import('../../features/branches/BranchesView').then((module) => module.BranchesView));
const ChangesetsView = lazyComponent(() => import('../../features/changesets/ChangesetsView').then((module) => module.ChangesetsView));
const CodeReviewsView = lazyComponent(() => import('../../features/codeReviews/CodeReviewsView').then((module) => module.CodeReviewsView));
const FilesView = lazyComponent(() => import('../../features/files/FilesView').then((module) => module.FilesView));
const IncomingChangesView = lazyComponent(() => import('../../features/incoming/IncomingChangesView').then((module) => module.IncomingChangesView));
const LabelsView = lazyComponent(() => import('../../features/labels/LabelsView').then((module) => module.LabelsView));
const LocksView = lazyComponent(() => import('../../features/locks/LocksView').then((module) => module.LocksView));
const PendingChangesView = lazyComponent(() => import('../../features/pendingChanges/PendingChangesView').then((module) => module.PendingChangesView));
const ShelvesView = lazyComponent(() => import('../../features/shelves/ShelvesView').then((module) => module.ShelvesView));
const SyncView = lazyComponent(() => import('../../features/sync/SyncView').then((module) => module.SyncView));

export interface ViewDefinition {
  id: ViewId;
  label: string;
  icon: Icon;
  group: 'Workspace' | 'History' | 'Collaborate';
  shortcut?: string;
  component: ComponentType;
  /** A hook returning a count to show next to the view in the sidebar. */
  useBadge?: () => number | undefined;
  /** A hook telling whether something waits in the view, shown as a dot. */
  useDot?: () => boolean;
}

export const VIEWS: ViewDefinition[] = [
  { id: 'changes', label: 'Changes', icon: FileDiff, group: 'Workspace', shortcut: 'mod+1', component: PendingChangesView, useBadge: usePendingChangesCount, useDot: useHasLeftChanges },
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
