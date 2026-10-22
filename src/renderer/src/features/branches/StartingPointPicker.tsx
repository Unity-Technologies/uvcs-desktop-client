import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { OptionCards } from '../../ui/OptionCards';
import { Popover } from '../../ui/Popover';
import type { NewBranchOrigin } from './CreateBranchDialog';
import styles from './StartingPointPicker.module.css';

interface StartingPointPickerProps {
  origins: NewBranchOrigin[];
  /** The chosen origin's index. */
  value: number;
  onChange: (index: number) => void;
}

/**
 * "Start from", at the new-branch dialog's top right: the starting points as cards, each explained, in a popover that
 * closes on a pick. Out of the dialog's body, which then reads the same with one starting point or several.
 */
export function StartingPointPicker({ origins, value, onChange }: StartingPointPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={400}
      align="end"
      trigger={
        <Button size="small" variant="ghost">
          Start from <ChevronDown size={14} aria-hidden />
        </Button>
      }
    >
      <div className={styles.choices}>
        <OptionCards
          label="Start from"
          heading
          cards={origins.map((origin, index) => ({
            value: String(index),
            title: origin.card?.title ?? origin.startingPointLabel,
            description: origin.card?.description ?? '',
          }))}
          value={String(value)}
          onChange={(index) => {
            onChange(Number(index));
            setOpen(false);
          }}
        />
      </div>
    </Popover>
  );
}
