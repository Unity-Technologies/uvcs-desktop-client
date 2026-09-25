import { Check, RotateCcw } from 'lucide-react';
import { Button } from '../../../ui/Button';
import type { MergeLabels } from '../mergeDescription';
import type { ConflictChoice } from './conflictChoices';
import styles from './ConflictChoiceBar.module.css';

interface ConflictChoiceBarProps {
  labels: MergeLabels;
  chosen: ConflictChoice | undefined;
  onChoose: (choice: ConflictChoice) => void;
  /** Set once the user decided something: back to the conflicts as the automatic merge left them. */
  onStartOver?: () => void;
}

/** How to settle a file with conflicts at once, the current choice picked; "Changes" then shows what it produces. */
export function ConflictChoiceBar({ labels, chosen, onChoose, onStartOver }: ConflictChoiceBarProps) {
  const { source, destination } = labels.roles;
  const choices: { choice: ConflictChoice; label: string; tip: string }[] = [
    { choice: 'destination', label: `Keep ${destination.name.toLowerCase()}`, tip: `The whole file as ${labels.destination} has it; the other side's changes to it are dropped` },
    { choice: 'source', label: `Keep ${source.name.toLowerCase()}`, tip: `The whole file as ${labels.source} has it; the other side's changes to it are dropped` },
    { choice: 'both', label: 'Keep both', tip: `Every conflict keeps the lines of both: ${labels.destination} first, then ${labels.source}` },
    { choice: 'byHand', label: 'Resolve by hand…', tip: 'Edit the merged text yourself, conflict markers included' },
  ];

  return (
    <div className={styles.bar} role="group" aria-label="Resolve this conflict">
      {choices.map(({ choice, label, tip }) => (
        <Button
          key={choice}
          size="small"
          className={styles.choice}
          aria-pressed={chosen === choice}
          icon={chosen === choice ? <Check size={12} strokeWidth={2.6} /> : undefined}
          data-tip={tip}
          onClick={() => onChoose(choice)}
        >
          {label}
        </Button>
      ))}
      {onStartOver && (
        <Button size="small" variant="ghost" icon={<RotateCcw size={12} />} data-tip="Back to the conflicts as the automatic merge left them" onClick={onStartOver}>
          Start over
        </Button>
      )}
    </div>
  );
}
