import { GitMerge } from 'lucide-react';
import { mergeInProgressWords } from '../../features/merge/mergeDescription';
import { NavItem } from '../../ui/nav/SidebarNav';
import type { MergeInProgress } from '../navigation/mergeInProgress';
import { navigation } from '../navigation/navigationStore';

/** The way back to the merge in progress, from any view or page: it shows the merge as it was left. */
export function MergeInProgressItem({ merge, shown }: { merge: MergeInProgress; shown: boolean }) {
  const words = mergeInProgressWords(merge.page.request);
  return (
    <NavItem
      icon={<GitMerge size={15} />}
      label={words.label}
      railLabel={words.railLabel}
      dot={`In progress: ${words.title}`}
      active={shown}
      onClick={navigation.returnToMerge}
    />
  );
}
