import { MoreHorizontal, Plus } from 'lucide-react';
import type { MergeToolRule } from '@shared/domain/mergeTools';
import type { MenuEntry } from '../../lib/actions';
import { useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { openMergeRuleDialog } from './MergeRuleDialog';
import { rowMenuEntries } from './mergeToolRules';
import { EVERY_OTHER_FILE, mergeToolRows, type MergeToolRowView } from './mergeToolRows';
import type { RuleTarget } from './mergeRuleDraft';
import { SettingsGroup } from './SettingsGroup';
import { saveSettings, useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** Which merge tool opens which files, tried top to bottom, and how resolving one by one goes on. */
export function MergeToolsPane() {
  const list = useMergeTools();
  const { mergeTool, mergeToolRules, askWhenMergeToolClosesUnsaved } = useSettings();
  const rows = mergeToolRows(mergeToolRules, mergeTool, list);
  const targetOf = (id: string): RuleTarget =>
    id === EVERY_OTHER_FILE ? { kind: 'everyOtherFile', mergeTool } : { kind: 'rule', rule: mergeToolRules.find((rule) => rule.id === id) ?? null };
  const saveRules = (rules: MergeToolRule[]): void => void saveSettings({ mergeToolRules: rules });

  return (
    <>
      <p className={styles.note}>
        A merge tool opens only when you ask, on one conflicting file or on each in turn. The first row that matches a file
        opens it; any tool can open it from the merge page too.
      </p>
      <SettingsGroup title="Open conflicts in">
        <div className={styles.rulesFrame}>
          <div className={styles.rules} role="list" aria-label="Merge tool by file type">
            {rows.map((row) => (
              <MergeToolRow
                key={row.id}
                row={row}
                onEdit={() => openMergeRuleDialog(targetOf(row.id))}
                menu={rowMenuEntries(mergeToolRules, row.id === EVERY_OTHER_FILE ? null : row.id, () => openMergeRuleDialog(targetOf(row.id)), saveRules)}
              />
            ))}
          </div>
        </div>
        <Button size="small" icon={<Plus size={13} />} onClick={() => openMergeRuleDialog({ kind: 'rule', rule: null })}>
          Add a file type
        </Button>
      </SettingsGroup>
      <SettingsGroup title="Resolving one by one">
        <Checkbox
          label="Ask before opening the next file when one is closed without saving"
          checked={askWhenMergeToolClosesUnsaved}
          onChange={(ask) => void saveSettings({ askWhenMergeToolClosesUnsaved: ask })}
        />
      </SettingsGroup>
    </>
  );
}

/** A row, read-only: its file types, what opens them, and its "…" menu on hover or focus. Clicking it edits it. */
function MergeToolRow({ row, onEdit, menu }: { row: MergeToolRowView; onEdit: () => void; menu: MenuEntry[] }) {
  const ToolIcon = row.toolIcon;
  return (
    <div className={styles.rule} role="listitem">
      <button type="button" className={styles.ruleMain} onClick={onEdit} aria-label={`${row.filesTip ?? row.files}: ${row.toolName}. Edit`}>
        <span className={styles.ruleFiles} data-code={row.filesAreCode || undefined} data-tip={row.filesTip}>
          <span className={styles.ruleFilesShown}>{row.files}</span>
          {row.moreFiles > 0 && <span className={styles.ruleFilesMore}>+{row.moreFiles}</span>}
        </span>
        <span className={styles.ruleTool}>
          <span className={styles.ruleToolName}>
            <span className={styles.ruleToolIcon}>{ToolIcon && <ToolIcon size={16} />}</span>
            {row.toolName}
          </span>
          {row.toolNote && <span className={styles.ruleToolNote}>{row.toolNote}</span>}
        </span>
      </button>
      <ActionDropdownMenu entries={menu}>
        <IconButton size="small" className={styles.ruleMenu} icon={<MoreHorizontal size={14} />} label={`More for ${row.files}`} />
      </ActionDropdownMenu>
    </div>
  );
}
