import { Archive, File, GitBranch, GitCommitVertical, GitPullRequestArrow, Link2, MessageSquareCode, Tag, type LucideIcon } from 'lucide-react';
import type { ChipIcon } from './chipContent';

/** Each object's icon, wherever a comment names it: its chip, and the suggestions that write it. */
export const CHIP_ICONS: Record<ChipIcon, LucideIcon> = {
  changeset: GitCommitVertical,
  branch: GitBranch,
  label: Tag,
  shelve: Archive,
  codeReview: MessageSquareCode,
  // A review's change request, as its thread's kind shows it (`THREAD_KIND_ICONS`).
  changeRequest: GitPullRequestArrow,
  file: File,
  link: Link2,
};
