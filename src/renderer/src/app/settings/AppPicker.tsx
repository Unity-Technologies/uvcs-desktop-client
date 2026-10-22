import { ChevronDown } from 'lucide-react';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { appPickerEntries, pickedApp, type AppPickerChoices } from './appPickerChoices';
import styles from './SettingsDialog.module.css';

interface AppPickerProps extends AppPickerChoices {
  label: string;
  /** One line, a text field's height, beside other fields in a dialog: where it is goes in its tooltip. */
  inline?: boolean;
}

/** One app setting as a drop-down: a long list of apps found stays out of the way of the settings below it. */
export function AppPicker({ label, inline = false, ...choices }: AppPickerProps) {
  const picked = pickedApp(choices);
  const PickedIcon = picked.icon;
  const tip = picked.tip ?? picked.description;
  return (
    <ActionDropdownMenu entries={appPickerEntries(choices)} align="start">
      <button type="button" className={inline ? styles.pickerInline : styles.picker} aria-label={`${label}: ${picked.label}`} data-tip={inline ? tip : undefined}>
        <span className={styles.pickerIcon}>{PickedIcon && <PickedIcon size={inline ? 16 : 18} />}</span>
        {inline ? (
          <span className={`${styles.pickerInlineLabel} ${styles.oneLine}`}>{picked.label}</span>
        ) : (
          <span className={styles.choiceText}>
            <span className={styles.choiceLabel}>{picked.label}</span>
            <span className={`${styles.choiceDescription} ${styles.oneLine}`} data-tip={tip}>
              {picked.description}
            </span>
          </span>
        )}
        <ChevronDown size={14} />
      </button>
    </ActionDropdownMenu>
  );
}
