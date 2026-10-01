import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { branchLabel, branchLabels } from '../../lib/branchLabels';
import { OptionCards, type OptionCard } from '../../ui/OptionCards';
import { pendingChangesPronoun } from './pendingChangesWords';
import type { SwitchChoice } from './switchOptions';

interface PendingChangesChoiceProps {
  /** Where the changes are now, e.g. `/main/t1`. */
  source: string;
  /** Where the workspace is going, e.g. `/main/t2`; null for a branch not named yet. */
  destination: string | null;
  choice: Pick<SwitchChoice, 'leave' | 'bring'>;
  /** How many changes there are, so one reads "it" and several "them". */
  count: number;
  value: PendingChangesAction | null;
  onChange: (value: PendingChangesAction) => void;
  /** Show "Your pending changes" above the cards, where the question isn't asked around them. */
  heading?: boolean;
}

/**
 * What happens to pending changes on a switch, in the same words wherever it comes up (switching, creating
 * a branch and switching to it): leave them behind in a shelve, or bring them along. Both branches go by their own
 * names (`branchLabels`), the one the changes are on in full in its tooltip.
 */
export function PendingChangesChoice({ source, destination, choice, count, value, onChange, heading = false }: PendingChangesChoiceProps) {
  const [sourceName, destinationName] = destination === null ? [branchLabel(source), null] : branchLabels(source, destination);
  const where = destinationName ?? 'the new branch';
  const them = pendingChangesPronoun(count);
  const cards: OptionCard<PendingChangesAction>[] = [
    {
      value: 'leave',
      title: <>Leave {them} on <code data-tip={source}>{sourceName}</code></>,
      description: choice.leave.disabledReason ?? `Saved in a shelve. You’ll be offered to restore ${them} when you come back.`,
      disabled: !choice.leave.enabled,
    },
    {
      value: 'bring',
      title: <>Bring {them} to {destinationName === null ? where : <code data-tip={destination}>{destinationName}</code>}</>,
      description: choice.bring.disabledReason ?? `Shelved, then applied on ${where}. If a file conflicts, you decide how to merge it.`,
      disabled: !choice.bring.enabled,
    },
  ];
  return <OptionCards label="Your pending changes" heading={heading} cards={cards} value={value} onChange={onChange} />;
}
