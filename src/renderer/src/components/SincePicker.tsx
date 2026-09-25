import { CalendarDays, Check } from 'lucide-react';
import { SINCE_PRESETS, sincePresetLabel, type SincePreset } from '../lib/sincePresets';
import { Button } from '../ui/Button';
import { ActionDropdownMenu } from '../ui/menu/ActionDropdownMenu';

interface SincePickerProps {
  value: SincePreset;
  onChange: (preset: SincePreset) => void;
}

/** Restricts a list to objects created recently ("Last month", "Any time"...). */
export function SincePicker({ value, onChange }: SincePickerProps) {
  const entries = SINCE_PRESETS.map((preset) => ({
    id: preset.value,
    label: preset.label,
    icon: preset.value === value ? Check : undefined,
    run: () => onChange(preset.value),
  }));

  return (
    <ActionDropdownMenu entries={entries} align="start">
      <Button variant="ghost" size="small" icon={<CalendarDays size={13} />}>
        {sincePresetLabel(value)}
      </Button>
    </ActionDropdownMenu>
  );
}
