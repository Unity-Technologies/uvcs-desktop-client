import { CalendarDays } from 'lucide-react';
import { SINCE_PRESETS, type SincePreset } from '../lib/sincePresets';
import { ChoiceChip } from '../ui/ChoiceChip';

interface SincePickerProps {
  value: SincePreset;
  onChange: (preset: SincePreset) => void;
}

/** Restricts a list to objects created recently ("Last month", "Any time"...). */
export function SincePicker({ value, onChange }: SincePickerProps) {
  return <ChoiceChip value={value} choices={SINCE_PRESETS} onChange={onChange} icon={<CalendarDays size={13} />} />;
}
