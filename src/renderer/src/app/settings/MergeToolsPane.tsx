import { MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { MergeToolList, MergeToolRule } from '@shared/domain/mergeTools';
import { addMergeTool } from '../../features/merge/mergeTools/CustomMergeToolDialog';
import { openMergeToolArgsDialog } from '../../features/merge/mergeTools/MergeToolArgsDialog';
import { currentSettings, preferMergeTool, useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import type { MenuEntry } from '../../lib/actions';
import { formatFilePatterns, parseFilePatterns } from '../../lib/filePatterns';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { TextField } from '../../ui/TextField';
import { AppPicker } from './AppPicker';
import type { AutomaticChoice } from './appPickerChoices';
import {
  addRule,
  AUTOMATIC_MERGE_TOOL_CHOICE,
  changeRule,
  newRuleToolId,
  pickableTools,
  ruleMenuEntries,
  ruleName,
  SAME_AS_OTHER_FILES_CHOICE,
  toolInUse,
  UNITY_ROW_LABEL,
  unityRowNote,
  unityRowTip,
} from './mergeToolRules';
import { saveSettings, useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

const saveRules = (change: (rules: MergeToolRule[]) => MergeToolRule[]): Promise<void> => saveSettings({ mergeToolRules: change(currentSettings().mergeToolRules) });

/** Which merge tool opens which files, tried top to bottom, and how resolving one by one goes on. */
export function MergeToolsPane() {
  const list = useMergeTools();
  const { mergeTool, mergeToolRules, unityMergeTool, askWhenMergeToolClosesUnsaved } = useSettings();
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
        <div className={styles.rules} role="list" aria-label="Merge tool by file type">
          <div className={styles.rule} role="listitem">
            <div className={styles.ruleFiles} data-tip={unityRowTip(list.smartMerge)}>
              <span>{UNITY_ROW_LABEL}</span>
              <span className={`${styles.choiceDescription} ${styles.oneLine}`}>{unityRowNote(list.smartMerge)}</span>
            </div>
            <ToolPicker label={UNITY_ROW_LABEL} list={list} choice={unityMergeTool} automatic={SAME_AS_OTHER_FILES_CHOICE} onChoose={(choice) => void saveSettings({ unityMergeTool: choice })} />
            <span />
          </div>
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
  const [text, setText] = useState(formatFilePatterns(rule.patterns));
  const save = (): void => {
    const patterns = parseFilePatterns(text);
    setText(formatFilePatterns(patterns));
    if (formatFilePatterns(patterns) !== formatFilePatterns(rule.patterns)) void saveRules((current) => changeRule(current, rule.id, { patterns }));
  };
  const menu: MenuEntry[] = ruleMenuEntries(rules, rule.id, (changed) => void saveSettings({ mergeToolRules: changed }));
  const name = ruleName(rule);

  return (
    <div className={styles.rule} role="listitem">
      <TextField
        className={styles.ruleField}
        aria-label="File types"
        data-tip="Extensions (.psd), names (*.prefab) or paths (Assets/Data/**), separated by spaces"
        placeholder=".psd .tga"
        value={text}
        autoFocus={focused}
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => event.key === 'Enter' && save()}
      />
      <ToolPicker label={name} list={list} choice={rule.toolId} automatic={null} onChoose={(toolId) => void saveRules((current) => changeRule(current, rule.id, { toolId }))} />
      <ActionDropdownMenu entries={menu}>
        <IconButton size="small" icon={<MoreHorizontal size={14} />} label={`More for ${name}`} />
      </ActionDropdownMenu>
    </div>
  );
}

interface ToolPickerProps {
  label: string;
  list: MergeToolList;
  choice: string;
  automatic: AutomaticChoice | null;
  onChoose: (choice: string) => void;
}

/** A row's tool, as a compact drop-down: the tools found, another app, and how the one picked opens. */
function ToolPicker({ label, list, choice, automatic, onChoose }: ToolPickerProps) {
  const picked = toolInUse(list, choice, automatic);
  const addAndPick = async (): Promise<void> => {
    const added = await addMergeTool();
    if (added) onChoose(added.id);
  };
  return (
    <AppPicker
      compact
      label={`Tool for ${label}`}
      apps={pickableTools(list.tools)}
      choice={choice}
      usedId={picked?.id ?? null}
      automatic={automatic}
      missingName={list.knownNames[choice]}
      onChoose={onChoose}
      onAdd={() => void addAndPick()}
      more={picked ? [{ id: 'howItOpens', label: `How ${picked.name} opens…`, icon: SlidersHorizontal, run: () => openMergeToolArgsDialog(picked) }] : []}
    />
  );
}
