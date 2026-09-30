import { Pilcrow } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { comparisonMethodLabel, type ComparisonMethod } from './comparisonMethod';
import { DiffNotice } from './DiffNotice';
import { IGNORED_DIFFERENCE_TITLES, ignoredDifference } from './ignoredDifference';

interface MethodHidingNoticeProps {
  /** The method that would show no change (`methodHidingEveryChange`). */
  method: ComparisonMethod;
  original: string;
  modified: string;
  onPick: (method: ComparisonMethod) => void;
}

/** Above a diff whose every change is what another comparison method ignores (every line ending changed): offers it. */
export function MethodHidingNotice({ method, original, modified, onPick }: MethodHidingNoticeProps) {
  return (
    <DiffNotice tone="info" icon={<Pilcrow size={13} />} action={<Button size="small" onClick={() => onPick(method)}>{comparisonMethodLabel(method)}</Button>}>
      {IGNORED_DIFFERENCE_TITLES[ignoredDifference(original, modified)]}.
    </DiffNotice>
  );
}
