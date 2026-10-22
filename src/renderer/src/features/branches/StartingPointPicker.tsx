import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { OptionCards, type OptionCard } from '../../ui/OptionCards';
import { Popover } from '../../ui/Popover';
import styles from './StartingPointPicker.module.css';

interface StartingPointPickerProps {
  /** From `startingPointCards`. */
  cards: OptionCard<string>[];
  /** The chosen origin's index. */
  value: number;
  /** What the button shows for it (`chosenStartingPoint`). */
  chosen: { name: string; title: string };
  onChange: (index: number) => void;
}

/**
 * "Start from", at the new-branch dialog's top right: the starting points as cards, each explained, in a popover that
 * closes on a pick: a click, or Enter. The arrow keys only move the choice, so each can be read before closing; Tab,
 * as Esc, closes it back to its button. Out of the dialog's body, which then reads the same with one starting point or
 * several.
 */
export function StartingPointPicker({ cards, value, chosen, onChange }: StartingPointPickerProps) {
  const [open, setOpen] = useState(false);
  const choicesRef = useRef<HTMLDivElement>(null);
  /** Whether the last input was a pointer: the arrow keys click a radio too, and those must not close the popover. */
  const pointing = useRef(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={400}
      align="end"
      onOpenAutoFocus={(event) => {
        // On the chosen card, not the first: Space there would pick the first one unnoticed.
        event.preventDefault();
        choicesRef.current?.querySelector<HTMLInputElement>('input:checked')?.focus();
      }}
      trigger={
        <Button size="small" variant="ghost" className={styles.trigger} data-tip={chosen.title}>
          <span className={styles.chosen}>Start from: {chosen.name}</span>
          <ChevronDown size={14} aria-hidden />
        </Button>
      }
    >
      <div
        ref={choicesRef}
        className={styles.choices}
        onPointerDown={() => (pointing.current = true)}
        // Closes on the radio's click, which a click anywhere on its card passes on once the choice changed; closing
        // on the card's own click would remove the radios before that, and the choice would never change.
        onClick={(event) => pointing.current && event.target instanceof HTMLInputElement && setOpen(false)}
        onKeyDown={(event) => {
          pointing.current = false;
          if (event.key !== 'Enter' && event.key !== 'Tab') return;
          event.preventDefault();
          setOpen(false);
        }}
      >
        <OptionCards
          label="Start from"
          heading
          cards={cards}
          value={String(value)}
          onChange={(index) => onChange(Number(index))}
        />
      </div>
    </Popover>
  );
}
