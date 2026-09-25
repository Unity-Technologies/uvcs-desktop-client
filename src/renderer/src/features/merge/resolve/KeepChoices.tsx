import { RotateCcw } from 'lucide-react';
import { Button } from '../../../ui/Button';
import type { MergeLabels } from '../mergeDescription';
import type { ConflictChoice } from './conflictChoices';
import styles from './KeepChoices.module.css';

interface KeepChoicesProps {
  labels: MergeLabels;
  chosen: ConflictChoice | undefined;
  onChoose: (choice: ConflictChoice) => void;
  /** Set once the user decided something: back to the conflicts as the automatic merge left them. */
  onStartOver?: () => void;
}

/**
 * How to settle a whole file with conflicts at once, next to "Resolve in <tool>": keep a version or both, in one
 * compact "Keep [Yours | Incoming | Both]" group (the word outside, the choices in their track) with the current choice pressed; "Changes" then shows what it produces.
 */
export function KeepChoices({ labels, chosen, onChoose, onStartOver }: KeepChoicesProps) {
  const { source, destination } = labels.roles;
  const choices: { choice: Exclude<ConflictChoice, 'byHand'>; label: string; tip: string }[] = [
    { choice: 'destination', label: destination.name, tip: `Whole file from ${labels.destination}` },
    { choice: 'source', label: source.name, tip: `Whole file from ${labels.source}` },
    { choice: 'both', label: 'Both', tip: `Both sides of every conflict, ${destination.name.toLowerCase()} first` },
  ];

  return (
    <>
      <span className={styles.keep} aria-hidden data-keep-label>
        Keep
      </span>
      <div className={styles.group} role="group" aria-label="Keep for the whole file">
        {choices.map(({ choice, label, tip }) => (
          <button
            key={choice}
            type="button"
            className={styles.choice}
            aria-pressed={chosen === choice}
            aria-label={`Keep ${label.toLowerCase()}`}
            data-tip={tip}
            onClick={() => onChoose(choice)}
          >
            {label}
          </button>
        ))}
      </div>
      {onStartOver && (
        <Button
          size="small"
          variant="ghost"
          icon={<RotateCcw size={13} />}
          aria-label="Start over"
          data-tip="Start over"
          onClick={onStartOver}
        />
      )}
    </>
  );
}
