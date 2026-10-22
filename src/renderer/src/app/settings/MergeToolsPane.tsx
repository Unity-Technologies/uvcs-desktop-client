import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { AUTO_MERGE_TOOL, type MergeToolList, type MergeToolRule } from '@shared/domain/mergeTools';
import { addMergeTool } from '../../features/merge/mergeTools/CustomMergeToolDialog';
import { openMergeToolArgsDialog } from '../../features/merge/mergeTools/MergeToolArgsDialog';
import { currentSettings, preferMergeTool, useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import type { MenuEntry } from '../../lib/actions';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { TokenField } from '../../ui/TokenField';
import { AppPicker } from './AppPicker';
import type { AutomaticChoice } from './appPickerChoices';
import {
  addRule,
  AUTOMATIC_MERGE_TOOL_CHOICE,
  changeRule,
  hasFallback,
  howItOpensEntries,
  missingToolName,
  newRuleToolId,
  pickableTools,
  ruleMenuEntries,
  ruleName,
  toolInUse,
} from './mergeToolRules';
import { saveSettings, useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

const saveRules = (change: (rules: MergeToolRule[]) => MergeToolRule[]): Promise<void> => saveSettings({ mergeToolRules: change(currentSettings().mergeToolRules) });

/** Which merge tool opens which files, tried top to bottom, and how resolving one by one goes on. */
export function MergeToolsPane() {
  const list = useMergeTools();
  const { mergeTool, mergeToolRules, askWhenMergeToolClosesUnsaved } = useSettings();
  // The row just added, whose file types come next.
  const [addedId, setAddedId] = useState<string>();

  const addFileType = (): void => {
    const id = `rule:${crypto.randomUUID()}`;
    setAddedId(id);
    void saveRules((rules) => addRule(rules, id, newRuleToolId(list)));
  };

  return (
    <>
      <p className={styles.note}>
        A merge tool opens only when you ask, on one conflicting file or on each in turn. The first row that matches a file
        opens it; any tool can open it from the merge page too.
      </p>
      <section className={styles.section}>
        <h2 className={styles.heading}>Open conflicts in</h2>
        <div className={styles.rulesFrame}>
          <div className={styles.rules} role="list" aria-label="Merge tool by file type">
            {mergeToolRules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} rules={mergeToolRules} list={list} focused={rule.id === addedId} />
            ))}
            <div className={styles.rule} role="listitem">
              <div className={styles.ruleFiles}>
                <span className={styles.oneLine}>Every other file</span>
              </div>
              <ToolPicker label="Every other file" list={list} choice={mergeTool} automatic={AUTOMATIC_MERGE_TOOL_CHOICE} onChoose={(choice) => void preferMergeTool(choice)} />
              <span />
            </div>
          </div>
        </div>
        <Button size="small" icon={<Plus size={13} />} onClick={addFileType}>
          Add a file type
        </Button>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Resolving one by one</h2>
        <Checkbox
          label="Ask before opening the next file when one is closed without saving"
          checked={askWhenMergeToolClosesUnsaved}
          onChange={(ask) => void saveSettings({ askWhenMergeToolClosesUnsaved: ask })}
        />
      </section>
    </>
  );
}

/** A row of file types: its patterns, edited in place and saved as the field is left, its tool, and its menu. */
function RuleRow({ rule, rules, list, focused }: { rule: MergeToolRule; rules: MergeToolRule[]; list: MergeToolList; focused: boolean }) {
  const menu: MenuEntry[] = ruleMenuEntries(rules, rule.id, (changed) => void saveSettings({ mergeToolRules: changed }));
  const name = ruleName(rule);

  return (
    <div className={styles.rule} role="listitem">
      <TokenField
        label={`File types of ${name}`}
        tokens={rule.patterns}
        tip="Extensions (.psd), names (*.prefab) or paths (Assets/Data/**)"
        placeholder=".psd .tga"
        autoFocus={focused}
        onChange={(patterns) => void saveRules((current) => changeRule(current, rule.id, { patterns }))}
      />
      <ToolPicker
        label={name}
        list={list}
        choice={rule.toolId}
        automatic={null}
        withUnityYamlMerge
        onChoose={(toolId) => void saveRules((current) => changeRule(current, rule.id, { toolId }))}
      />
      <ActionDropdownMenu entries={menu}>
        <IconButton size="small" icon={<MoreHorizontal size={14} />} label={`More for ${name}`} />
      </ActionDropdownMenu>
      {hasFallback(rule) && (
        <div className={styles.ruleFallback}>
          <span className={styles.ruleFallbackLabel}>If it can't merge, open</span>
          <ToolPicker
            label={`what UnityYAMLMerge can't merge in ${name}`}
            list={list}
            choice={rule.fallbackToolId ?? AUTO_MERGE_TOOL}
            automatic={AUTOMATIC_MERGE_TOOL_CHOICE}
            onChoose={(fallbackToolId) => void saveRules((current) => changeRule(current, rule.id, { fallbackToolId }))}
          />
        </div>
      )}
    </div>
  );
}

interface ToolPickerProps {
  label: string;
  list: MergeToolList;
  choice: string;
  automatic: AutomaticChoice | null;
  /** Offers UnityYAMLMerge too: a row's own tool, not a fallback or every other file's. */
  withUnityYamlMerge?: boolean;
  onChoose: (choice: string) => void;
}

/** A row's tool, as a compact drop-down: the tools found, another app, and how the one picked opens. */
function ToolPicker({ label, list, choice, automatic, withUnityYamlMerge = false, onChoose }: ToolPickerProps) {
  const picked = toolInUse(list, choice, automatic);
  const addAndPick = async (): Promise<void> => {
    const added = await addMergeTool();
    if (added) onChoose(added.id);
  };
  return (
    <AppPicker
      compact
      label={`Tool for ${label}`}
      apps={pickableTools(list, withUnityYamlMerge)}
      choice={choice}
      usedId={picked?.id ?? null}
      automatic={automatic}
      missingName={missingToolName(list, choice)}
      onChoose={onChoose}
      onAdd={() => void addAndPick()}
      more={howItOpensEntries(picked, openMergeToolArgsDialog)}
    />
  );
}
