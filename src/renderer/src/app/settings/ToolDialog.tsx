import { FolderOpen } from 'lucide-react';
import { useId, useState } from 'react';
import { TOOL_TARGET_LABELS, TOOL_TARGETS, type Tool } from '@shared/domain/tools';
import { api } from '../../api/client';
import { PLATFORM, PROGRAM_PLACEHOLDER } from '../../lib/platform';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { TextField } from '../../ui/TextField';
import fieldStyles from '../../ui/Field.module.css';
import { draftOfTool, NEW_TOOL_DRAFT, TOOL_PLACEHOLDER_HINTS, toolDraftProblem, toolNamePlaceholder, toolOfDraft, toolPreview, withTarget, type ToolDraft } from './toolSettings';
import styles from './SettingsDialog.module.css';

/** Adds a tool (`tool` null) or edits one; `save` stores the tool the dialog ends with. */
export function openToolDialog(tool: Tool | null, save: (tool: Tool) => Promise<void>): void {
  openDialog((close) => <ToolDialog tool={tool} save={save} close={close} />);
}

function ToolDialog({ tool, save, close }: { tool: Tool | null; save: (tool: Tool) => Promise<void>; close: () => void }) {
  const [draft, setDraft] = useState<ToolDraft>(() => (tool ? draftOfTool(tool) : NEW_TOOL_DRAFT));
  const change = (changes: Partial<ToolDraft>): void => setDraft((current) => ({ ...current, ...changes }));
  const problem = toolDraftProblem(draft);
  const preview = toolPreview(draft, PLATFORM);
  const runsOnId = useId();

  const choose = async (): Promise<void> => {
    const picked = await api.apps.pickProgram();
    if (picked) change({ program: picked });
  };
  const submit = async (): Promise<void> => {
    if (problem) return;
    await save(toolOfDraft(draft, tool?.id ?? `tool:${crypto.randomUUID()}`));
    close();
  };

  return (
    <Dialog
      title={tool ? 'Edit tool' : 'Add a tool'}
      description="It runs only when you pick it from an object's Tools menu, once for each object selected."
      width={520}
      onClose={close}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          {/* A disabled button gets no pointer: its wrapper says why it's off. */}
          <span data-tip={problem}>
            <Button type="submit" variant="primary" disabled={problem !== undefined}>
              {tool ? 'Save' : 'Add'}
            </Button>
          </span>
        </>
      }
    >
      <div className={styles.programRow}>
        <TextField label="Program" value={draft.program} placeholder={PROGRAM_PLACEHOLDER} onChange={(event) => change({ program: event.target.value })} autoFocus />
        <Button icon={<FolderOpen size={13} />} onClick={() => void choose()}>
          Choose…
        </Button>
      </div>
      <TextField label="Name" value={draft.name} placeholder={toolNamePlaceholder(draft)} onChange={(event) => change({ name: event.target.value })} />
      <div className={fieldStyles.field}>
        <TextField label="Arguments" value={draft.argsText} onChange={(event) => change({ argsText: event.target.value })} className={styles.args} />
        <span className={`${fieldStyles.hint} ${styles.toolPlaceholders}`}>
          {TOOL_PLACEHOLDER_HINTS.map(({ name, meaning }) => (
            <code key={name} data-tip={meaning}>
              {name}
            </code>
          ))}
        </span>
      </div>
      <div className={fieldStyles.field} role="group" aria-labelledby={runsOnId}>
        <span className={fieldStyles.label} id={runsOnId}>
          Runs on
        </span>
        <div className={styles.toolTargets}>
          {TOOL_TARGETS.map((target) => (
            <Checkbox key={target} label={TOOL_TARGET_LABELS[target]} checked={draft.targets.includes(target)} onChange={(on) => change({ targets: withTarget(draft.targets, target, on) })} />
          ))}
        </div>
      </div>
      {preview && (
        <p className={styles.toolPreview}>
          <span className={styles.toolPreviewLabel}>For example</span>
          <code className={`${styles.args} ${styles.oneLine}`}>{preview}</code>
        </p>
      )}
    </Dialog>
  );
}
