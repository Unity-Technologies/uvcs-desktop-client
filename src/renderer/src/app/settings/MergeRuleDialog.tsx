import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AUTO_MERGE_TOOL } from '@shared/domain/mergeTools';
import { addMergeTool, PLACEHOLDER_HINT } from '../../features/merge/mergeTools/CustomMergeToolDialog';
import { currentSettings, preferMergeTool, removeCustomMergeTool, setMergeToolArgs, useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import { formatArgs } from '../../lib/argumentLine';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SelectField, TextField } from '../../ui/TextField';
import { TokenField } from '../../ui/TokenField';
import fieldStyles from '../../ui/Field.module.css';
import { AppPicker } from './AppPicker';
import {
  argsToSave,
  draftFields,
  draftOf,
  editorOptions,
  fallbackChoices,
  ruleOf,
  savedDraft,
  saveProblem,
  toolChoices,
  withRule,
  withTool,
  type RuleDraft,
  type RuleTarget,
} from './mergeRuleDraft';
import { saveSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

const NO_TOOL = 'No merge tool found';

/** Edits a row of Settings › Merge: a rule's file types and what opens them, or every other file's tool. */
export function openMergeRuleDialog(target: RuleTarget): void {
  openDialog((close) => <MergeRuleDialog target={target} close={close} />);
}

function MergeRuleDialog({ target, close }: { target: RuleTarget; close: () => void }) {
  const list = useMergeTools();
  const [draft, setDraft] = useState<RuleDraft>(() => draftOf(target, list));
  const change = (changes: Partial<RuleDraft>): void => setDraft((current) => ({ ...current, ...changes }));
  const fields = draftFields(target, draft, list);
  const problem = saveProblem(target, draft, fields);
  const { args } = fields;

  const save = async (): Promise<void> => {
    if (problem) return;
    const edited = argsToSave(fields);
    if (edited) await setMergeToolArgs(edited.tool, edited.args);
    const saved = savedDraft(target, draft, fields);
    if (target.kind === 'everyOtherFile') await preferMergeTool(saved.toolId);
    else await saveSettings({ mergeToolRules: withRule(currentSettings().mergeToolRules, ruleOf(saved, target.rule?.id ?? `rule:${crypto.randomUUID()}`)) });
    close();
  };
  const addTool = (pick: (toolId: string) => void) => async (): Promise<void> => {
    const added = await addMergeTool();
    if (added) pick(added.id);
  };
  const removeTool = async (toolId: string): Promise<void> => {
    await removeCustomMergeTool(toolId);
    setDraft((current) => withTool(current, AUTO_MERGE_TOOL));
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
            <span className={fieldStyles.hint}>
              {draft.patterns.length === 0 ? 'Add at least one file type' : 'Extensions, names or paths. Enter, a space or a comma adds one.'}
            </span>
          </div>
        )}
        <div className={fieldStyles.field}>
          <span className={fieldStyles.label}>Opens in</span>
          <AppPicker
            label="Opens in"
            apps={toolChoices(target, list, draft.editorId)}
            choice={fields.shownToolId ?? ''}
            usedId={null}
            automatic={null}
            missingName={list.knownNames[fields.shownToolId ?? ''] ?? NO_TOOL}
            onChoose={(toolId) => setDraft((current) => withTool(current, toolId))}
            onAdd={() => void addTool((toolId) => setDraft((current) => withTool(current, toolId)))()}
          />
        </div>
        {args && (
          <div className={fieldStyles.field}>
            <TextField
              label={`How ${args.tool.name} opens`}
              className={styles.argsInput}
              value={args.text}
              error={args.problem}
              hint={`${PLACEHOLDER_HINT} They apply wherever ${args.tool.name} opens.`}
              onChange={(event) => change({ argsText: event.target.value })}
            />
            {(args.canGoBack || args.removable) && (
              <div className={styles.argsActions}>
                {args.canGoBack && (
                  <Button size="small" variant="ghost" className={styles.linkButton} onClick={() => change({ argsText: formatArgs(args.tool.defaultArgs) })}>
                    Back to its own arguments
                  </Button>
                )}
                {args.removable && (
                  <Button size="small" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void removeTool(args.tool.id)}>
                    Remove {args.tool.name}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
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
                choice={fields.shownFallbackId ?? ''}
                usedId={null}
                automatic={null}
                missingName={NO_TOOL}
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
