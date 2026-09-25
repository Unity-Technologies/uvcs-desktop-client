import { Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@shared/domain/settings';
import type { Icon } from '../../lib/actions';

export const THEMES: { value: ThemePreference; label: string; description: string; icon: Icon }[] = [
  { value: 'system', label: 'System', description: 'Match the OS appearance', icon: Monitor },
  { value: 'light', label: 'Light', description: 'Bright surfaces', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Dim surfaces for low light', icon: Moon },
];
