import { ChevronDown } from 'lucide-react';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { appPickerEntries, pickedApp, type AppPickerChoices } from './appPickerChoices';
import styles from './SettingsDialog.module.css';

/** One app setting as a drop-down: a long list of apps found stays out of the way of the settings below it. */
export function AppPicker({ label, ...choices }: AppPickerChoices & { label: string }) {
  const picked = pickedApp(choices);
  const PickedIcon = picked.icon;
  return (
    <ActionDropdownMenu entries={appPickerEntries(choices)} align="start">
      <button type="button" className={styles.picker} aria-label={`${label}: ${picked.label}`}>
        <span className={styles.pickerIcon}>{PickedIcon && <PickedIcon size={18} />}</span>
        <span className={styles.choiceText}>
          <span className={styles.choiceLabel}>{picked.label}</span>
          <span className={`${styles.choiceDescription} ${styles.oneLine}`} data-tip={picked.description}>
            {picked.description}
          </span>
        </span>
        <ChevronDown size={14} />
      </button>
    </ActionDropdownMenu>
  );
}
