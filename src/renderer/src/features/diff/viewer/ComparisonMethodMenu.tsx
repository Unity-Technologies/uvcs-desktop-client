import { Pilcrow } from 'lucide-react';
import { IconButton } from '../../../ui/IconButton';
import { DescribedMenu } from '../../../ui/menu/DescribedMenu';
import { COMPARISON_METHODS, comparisonMethodLabel, DEFAULT_COMPARISON_METHOD, type ComparisonMethod } from './comparisonMethod';

interface ComparisonMethodMenuProps {
  value: ComparisonMethod;
  onChange: (method: ComparisonMethod) => void;
}

/** Picks which differences a text diff shows, like the official client's "Comparison method" options. */
export function ComparisonMethodMenu({ value, onChange }: ComparisonMethodMenuProps) {
  return (
    <DescribedMenu
      title="Comparison method"
      items={COMPARISON_METHODS.map((option) => ({ id: option.value, label: option.label, description: option.description, checked: option.value === value, run: () => onChange(option.value) }))}
    >
      <IconButton
        size="small"
        icon={<Pilcrow size={14} />}
        label={`Comparison method: ${comparisonMethodLabel(value)}`}
        // Lit while something is ignored, like the other toggles away from their default.
        variant={value === DEFAULT_COMPARISON_METHOD ? 'ghost' : 'secondary'}
      />
    </DescribedMenu>
  );
}
