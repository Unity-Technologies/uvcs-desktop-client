import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { TextArea, TextField } from '../../ui/TextField';
import { HuePicker } from './HuePicker';
import { hasCondition, isFormatRule, type ExplorerRule } from './model/explorerRules';
import { conditionHint, EXPANSION_OPTIONS, ruleDraftProblem, ruleEditorTitle } from './model/ruleList';
import styles from './ExplorerRuleEditor.module.css';

/** Edits a copy of `rule`, resolving with it once saved, or `undefined` when dismissed. */
export function editExplorerRule(rule: ExplorerRule, isNew: boolean): Promise<ExplorerRule | undefined> {
  return askDialog<ExplorerRule>((finish) => <ExplorerRuleEditor rule={rule} isNew={isNew} onFinish={finish} />);
}

interface ExplorerRuleEditorProps {
  rule: ExplorerRule;
  isNew: boolean;
  onFinish: (rule: ExplorerRule | undefined) => void;
}

function ExplorerRuleEditor({ rule, isNew, onFinish }: ExplorerRuleEditorProps) {
  const [draft, setDraft] = useState(rule);
  const [triedSaving, setTriedSaving] = useState(false);
  const problem = ruleDraftProblem(draft);
  const save = (): void => {
    setTriedSaving(true);
    if (!problem) onFinish(draft);
  };
  const change = (changes: Partial<ExplorerRule>): void => setDraft((current) => ({ ...current, ...changes }));

  return (
    <Dialog
      title={ruleEditorTitle(draft.kind, isNew)}
      width={460}
      onClose={() => onFinish(undefined)}
      onSubmit={save}
      footer={
        <>
          <Button onClick={() => onFinish(undefined)}>Cancel</Button>
          <Button variant="primary" type="submit">
            {isNew ? 'Add' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        <TextField label="Description" value={draft.description} autoFocus onChange={(event) => change({ description: event.target.value })} />
        {hasCondition(draft.kind) && (
          <TextArea
            label="Condition"
            className={styles.condition}
            hint={conditionHint(draft.kind) ?? undefined}
            error={triedSaving ? (problem ?? undefined) : undefined}
            value={draft.condition}
            rows={3}
            spellCheck={false}
            onChange={(event) => change({ condition: event.target.value })}
          />
        )}
        {!isFormatRule(draft) && (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>Also take</legend>
            {EXPANSION_OPTIONS.map(({ option, label }) => (
              <Checkbox
                key={option}
                label={label}
                checked={draft.expansion[option]}
                onChange={(checked) => change({ expansion: { ...draft.expansion, [option]: checked } })}
              />
            ))}
          </fieldset>
        )}
        {isFormatRule(draft) && (
          <div className={styles.group}>
            <span className={styles.legend}>Color</span>
            <HuePicker hue={draft.hue} onChange={(hue) => change({ hue })} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
