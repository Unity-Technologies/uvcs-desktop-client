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
  onChange: (index: number) => void;
}

/**
 * "Start from", at the new-branch dialog's top right: the starting points as cards, each explained, in a popover that
 * closes on a pick: a click, or Enter. The arrow keys only move the choice, so each can be read before closing; Tab,
 * as Esc, closes it back to its button. Out of the dialog's body, which then reads the same with one starting point or
 * several.
 */
export function StartingPointPicker({ cards, value, onChange }: StartingPointPickerProps) {
  const [open, setOpen] = useState(false);
  const choicesRef = useRef<HTMLDivElement>(null);
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
        <Button size="small" variant="ghost">
          Start from <ChevronDown size={14} aria-hidden />
        </Button>
      }
    >
      <div
        ref={choicesRef}
        className={styles.choices}
        // A click on a card, not the arrow keys' synthetic click on a radio (`detail` 0).
        onClick={(event) => event.detail > 0 && event.target instanceof Element && event.target.closest('label') && setOpen(false)}
        onKeyDown={(event) => {
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
