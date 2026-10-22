import { useState } from 'react';
import { addMergeTool } from '../../features/merge/mergeTools/CustomMergeToolDialog';
import { openMergeToolArgsDialog } from '../../features/merge/mergeTools/MergeToolArgsDialog';
import { currentSettings, preferMergeTool, useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SelectField } from '../../ui/TextField';
import { TokenField } from '../../ui/TokenField';
import fieldStyles from '../../ui/Field.module.css';
import { AppPicker } from './AppPicker';
import { draftFields, draftOf, editorOptions, fallbackChoices, ruleOf, saveProblem, toolChoices, withRule, type RuleDraft, type RuleTarget } from './mergeRuleDraft';
import { AUTOMATIC_MERGE_TOOL_CHOICE } from './mergeToolRules';
import { saveSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** Edits a row of Settings › Merge: a rule's file types and what opens them, or every other file's tool. */
export function openMergeRuleDialog(target: RuleTarget): void {
  openDialog((close) => <MergeRuleDialog target={target} close={close} />);
}

function MergeRuleDialog({ target, close }: { target: RuleTarget; close: () => void }) {
  const list = useMergeTools();
  const [draft, setDraft] = useState<RuleDraft>(() => draftOf(target, list));
  const change = (changes: Partial<RuleDraft>): void => setDraft((current) => ({ ...current, ...changes }));
  const fields = draftFields(target, draft, list);
  const problem = saveProblem(target, draft);

  const save = async (): Promise<void> => {
    if (problem) return;
    if (target.kind === 'everyOtherFile') await preferMergeTool(draft.toolId);
    else await saveSettings({ mergeToolRules: withRule(currentSettings().mergeToolRules, ruleOf(draft, target.rule?.id ?? `rule:${crypto.randomUUID()}`)) });
    close();
  };
  const addTool = (pick: (toolId: string) => void) => async (): Promise<void> => {
    const added = await addMergeTool();
    if (added) pick(added.id);
  };

  return (
    <Dialog
      title={fields.title}
      width={480}
      onClose={close}
      onSubmit={() => void save()}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={Boolean(problem)}>
            Save
          </Button>
        </>
      }
    >
      <div className={styles.ruleForm}>
        {fields.files && (
          <div className={fieldStyles.field}>
            <span className={fieldStyles.label}>Files</span>
            <TokenField
              label="Files"
              tokens={draft.patterns}
              placeholder=".psd .tga Assets/Data/**"
              tip="Extensions (.psd), names (*.prefab) or paths (Assets/Data/**)"
              autoFocus
              onChange={(patterns) => change({ patterns })}
            />
            <span className={fieldStyles.hint}>{problem ?? 'Extensions, names or paths. Enter, a space or a comma adds one.'}</span>
          </div>
        )}
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label}>Opens in</span>
          <AppPicker
            label="Opens in"
            apps={toolChoices(target, list)}
            choice={draft.toolId}
            usedId={fields.automatic ? list.preferredId : null}
            automatic={fields.automatic ? AUTOMATIC_MERGE_TOOL_CHOICE : null}
            missingName={list.knownNames[draft.toolId]}
            onChoose={(toolId) => change({ toolId })}
            onAdd={() => void addTool((toolId) => change({ toolId }))()}
          />
          {fields.howItOpens && (
            <div>
              <Button size="small" variant="ghost" className={styles.linkButton} onClick={() => openMergeToolArgsDialog(fields.howItOpens!)}>
                How {fields.howItOpens.name} opens…
              </Button>
            </div>
          )}
        </div>
        {fields.unityYamlMerge && (
          <>
            <SelectField label="Unity Editor" value={draft.editorId} onChange={(event) => change({ editorId: event.target.value })}>
              {editorOptions(list, draft.editorId).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <div className={fieldStyles.field}>
              <span className={fieldStyles.label}>If it can't merge</span>
              <AppPicker
                label="If it can't merge"
                apps={fallbackChoices(list)}
                choice={draft.fallbackToolId}
                usedId={list.preferredId}
                automatic={AUTOMATIC_MERGE_TOOL_CHOICE}
                missingName={list.knownNames[draft.fallbackToolId]}
                onChoose={(fallbackToolId) => change({ fallbackToolId })}
                onAdd={() => void addTool((fallbackToolId) => change({ fallbackToolId }))()}
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
