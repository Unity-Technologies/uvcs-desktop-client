import { History } from 'lucide-react';
import { Button } from '../../ui/Button';

interface SinceReviewButtonProps {
  pressed: boolean;
  onChange: (pressed: boolean) => void;
}

/** Next to a diff of a file changed since its review: shows just what changed since, or all of it again. */
export function SinceReviewButton({ pressed, onChange }: SinceReviewButtonProps) {
  return (
    <Button
      size="small"
      variant={pressed ? 'secondary' : 'ghost'}
      icon={<History size={13} />}
      aria-pressed={pressed}
      data-tip={pressed ? 'Show all the changes to this file' : 'Show only what changed since you reviewed this file'}
      onClick={() => onChange(!pressed)}
    >
      Since review
    </Button>
  );
}
