import { X } from 'lucide-react';
import { mergeAwaiting } from '../../app/navigation/mergeInProgress';
import { navigation, useNavigation } from '../../app/navigation/navigationStore';
import { confirm } from '../../ui/dialog/confirm';
import { IconButton } from '../../ui/IconButton';

/**
 * Ends the merge in progress, the one way out that drops it: going elsewhere only sets it aside (`MergeInProgress`).
 * None once it settled, when leaving it closes it anyway.
 */
export function CloseMergeButton({ className }: { className?: string }) {
  const inProgress = useNavigation((state) => mergeAwaiting(state.merge) !== null);
  if (!inProgress) return null;
  return <IconButton className={className} size="small" icon={<X size={14} />} label="Close merge" onClick={() => void closeMergeAsked()} />;
}

async function closeMergeAsked(): Promise<void> {
  const close = await confirm({ title: 'Close this merge?', message: 'What you decided in it is discarded. Nothing was merged yet.', confirmLabel: 'Close merge', danger: true });
  if (close) navigation.closeMerge();
}
