import { FileCog } from 'lucide-react';
import { Button } from '../ui/Button';

interface MetaDiffButtonProps {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}

/** Next to the diff of a Unity asset whose `.meta` changed too: shows the `.meta`'s diff, or the asset's again. */
export function MetaDiffButton({ pressed, onChange }: MetaDiffButtonProps) {
  return (
    <Button
      size="small"
      variant={pressed ? 'secondary' : 'ghost'}
      icon={<FileCog size={13} />}
      aria-pressed={pressed}
      data-tip={pressed ? "Show this file's diff" : "Show the diff of this file's .meta"}
      onClick={() => onChange(!pressed)}
    >
      .meta
    </Button>
  );
}
