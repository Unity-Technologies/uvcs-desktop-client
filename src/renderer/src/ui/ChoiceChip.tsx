import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { ActionDropdownMenu } from './menu/ActionDropdownMenu';
import { MenuChip } from './ToggleChip';

interface Choice<Value extends string> {
  value: Value;
  label: string;
}

interface ChoiceChipProps<Value extends string> {
  value: Value;
  choices: Choice<Value>[];
  onChange: (value: Value) => void;
  icon?: ReactNode;
  /** The choice that doesn't filter anything, e.g. "Any status"; any other choice highlights the chip. */
  neutralValue?: Value;
}

/** A compact filter that picks one of several values from a menu. */
export function ChoiceChip<Value extends string>({ value, choices, onChange, icon, neutralValue }: ChoiceChipProps<Value>) {
  const entries = choices.map((choice) => ({
    id: choice.value,
    label: choice.label,
    icon: choice.value === value ? Check : undefined,
    run: () => onChange(choice.value),
  }));
  const current = choices.find((choice) => choice.value === value);

  return (
    <ActionDropdownMenu entries={entries} align="start">
      <MenuChip icon={icon} active={neutralValue !== undefined && value !== neutralValue}>
        {current?.label}
      </MenuChip>
    </ActionDropdownMenu>
  );
}
