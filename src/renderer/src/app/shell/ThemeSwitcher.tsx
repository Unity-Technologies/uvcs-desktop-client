import { Moon, Sun } from 'lucide-react';
import { DescribedMenu } from '../../ui/menu/DescribedMenu';
import { IconButton } from '../../ui/IconButton';
import { THEMES } from '../settings/themes';
import { useResolvedTheme } from '../settings/useResolvedTheme';
import { useSettings, useUpdateSettings } from '../settings/useSettings';

/** Picks System, Light or Dark. The icon shows the theme in use, so "System" shows a sun or a moon. */
export function ThemeSwitcher() {
  const { theme } = useSettings();
  const resolved = useResolvedTheme();
  const updateSettings = useUpdateSettings();
  const current = THEMES.find((option) => option.value === theme)?.label ?? 'System';

  const items = THEMES.map((option) => ({
    id: option.value,
    label: option.label,
    description: option.description,
    icon: option.icon,
    checked: option.value === theme,
    run: () => updateSettings({ theme: option.value }),
  }));

  return (
    <DescribedMenu items={items} title="Appearance">
      <IconButton icon={resolved === 'dark' ? <Moon size={15} /> : <Sun size={15} />} label={`Theme: ${current}`} />
    </DescribedMenu>
  );
}
