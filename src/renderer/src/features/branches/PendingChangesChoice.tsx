import type { PendingChangesAction } from '@shared/domain/switchWithChanges';
import { OptionCards, type OptionCard } from '../../ui/OptionCards';
import type { SwitchChoice } from './switchOptions';

interface PendingChangesChoiceProps {
  /** Where the changes are now, e.g. `/main/t1`. */
  source: string;
  /** Where the workspace is going, e.g. `/main/t2` or "the new branch". */
  destination: string;
  choice: Pick<SwitchChoice, 'leave' | 'bring'>;
  value: PendingChangesAction | null;
  onChange: (value: PendingChangesAction) => void;
  /** Show "Your pending changes" above the cards, where the question isn't asked around them. */
  heading?: boolean;
}

/**
 * What happens to pending changes on a switch, in the same words wherever it comes up (switching, creating
 * a branch and switching to it): leave them behind in a shelve, or bring them along.
 */
export function PendingChangesChoice({ source, destination, choice, value, onChange, heading = false }: PendingChangesChoiceProps) {
  const cards: OptionCard<PendingChangesAction>[] = [
    {
      value: 'leave',
      title: <>Leave them on <code>{source}</code></>,
      description: choice.leave.disabledReason ?? 'Saved in a shelve. You’ll be offered to restore them when you come back.',
      disabled: !choice.leave.enabled,
    },
    {
      value: 'bring',
      title: <>Bring them to <code>{destination}</code></>,
      description: choice.bring.disabledReason ?? `Shelved, then applied on ${destination}. If a file conflicts, you decide how to merge it.`,
      disabled: !choice.bring.enabled,
    },
  ];
  return <OptionCards label="Your pending changes" heading={heading} cards={cards} value={value} onChange={onChange} />;
}
