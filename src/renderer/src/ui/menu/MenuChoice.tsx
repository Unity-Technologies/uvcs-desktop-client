import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { Icon } from '../../lib/actions';
import menuStyles from './Menu.module.css';

/** A choice applies with the menu open, so the view behind it shows the outcome; Esc or a click away closes it. */
export const keepMenuOpen = (event: Event): void => event.preventDefault();

/**
 * One of a view menu's choices (a layout, a sort), inside a `DropdownMenu.RadioGroup`: its icon, its name and a check
 * when chosen. It applies with the menu still open (`keepMenuOpen`).
 */
export function MenuChoice({ value, icon: ChoiceIcon, label, checked }: { value: string; icon?: Icon; label: string; checked: boolean }) {
  return (
    <DropdownMenu.RadioItem className={menuStyles.item} value={value} onSelect={keepMenuOpen}>
      {/* Always there, empty without an icon, so every label of the menu starts in the same column. */}
      <span className={menuStyles.icon}>{ChoiceIcon && <ChoiceIcon size={14} />}</span>
      <span className={menuStyles.label}>{label}</span>
      <MenuMark shown={checked} />
    </DropdownMenu.RadioItem>
  );
}

/** The choice made, after its label, as every menu marks it; its room kept when not, so every label ends in one place. */
export function MenuMark({ shown }: { shown: boolean }) {
  return <span className={menuStyles.check}>{shown ? <Check size={14} /> : <span className={menuStyles.noMark} />}</span>;
}
