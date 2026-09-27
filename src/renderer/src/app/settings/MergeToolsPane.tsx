import { AppWindow, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AUTO_MERGE_TOOL, formatArgs, parseArgs, type MergeTool } from '@shared/domain/mergeTools';
import { addMergeToolAndPick, PLACEHOLDER_HINT } from '../../features/merge/mergeTools/CustomMergeToolDialog';
import { preferMergeTool, removeCustomMergeTool, setMergeToolArgs, useMergeTools } from '../../features/merge/mergeTools/useMergeTools';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { TextField } from '../../ui/TextField';
import { saveSettings, useSettings } from './useSettings';
import { AUTOMATIC_MERGE_TOOL_RULE, automaticMergeToolDescription } from './automaticMergeTool';
import styles from './SettingsDialog.module.css';

/** Which merge tool "Resolve in…" opens, and how it's called. */
export function MergeToolsPane() {
  const { tools, preferred } = useMergeTools();
  const { mergeTool: choice, askWhenMergeToolClosesUnsaved } = useSettings();
  const automatic = choice === AUTO_MERGE_TOOL || !tools.some((tool) => tool.id === choice);

  return (
    <>
      <p className={styles.note}>
        A merge tool opens only when you ask, on one conflicting file or on each in turn, and the file takes what you save
        there. Merges and updates never open one by themselves.
      </p>
      <section className={styles.section}>
        <h2 className={styles.heading}>Resolve conflicts in</h2>
        <div className={styles.choices} role="radiogroup" aria-label="Merge tool">
          <ToolChoice
            icon={<Sparkles size={18} />}
            label="Automatic"
            description={automaticMergeToolDescription(automatic ? preferred?.name : undefined)}
            tip={AUTOMATIC_MERGE_TOOL_RULE}
            selected={automatic}
            onSelect={() => void preferMergeTool(AUTO_MERGE_TOOL)}
          />
          {tools.map((tool) => (
            <ToolChoice
              key={tool.id}
              icon={<AppWindow size={18} />}
              label={tool.name}
              description={tool.executable}
              selected={!automatic && tool.id === choice}
              onSelect={() => void preferMergeTool(tool.id)}
            />
          ))}
        </div>
        <Button size="small" icon={<Plus size={13} />} onClick={() => void addMergeToolAndPick()}>
          Add another app…
        </Button>
      </section>
      {preferred && <ToolArguments key={`${preferred.id}:${preferred.args.join('\0')}`} tool={preferred} />}
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

interface ToolChoiceProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  /** The description's tooltip; the description itself by default, e.g. a path cut off. */
  tip?: string;
  selected: boolean;
  onSelect: () => void;
}

function ToolChoice({ icon, label, description, tip = description, selected, onSelect }: ToolChoiceProps) {
  return (
    <button type="button" role="radio" aria-checked={selected} className={styles.choice} data-selected={selected} onClick={onSelect}>
      {icon}
      <span className={styles.choiceText}>
        <span className={styles.choiceLabel}>{label}</span>
        <span className={`${styles.choiceDescription} ${styles.oneLine}`} data-tip={tip}>
          {description}
        </span>
      </span>
      {selected && <Check size={14} />}
    </button>
  );
}

/** The preferred tool's arguments, editable; saved when the field is left or Enter is pressed. */
function ToolArguments({ tool }: { tool: MergeTool }) {
  const [text, setText] = useState(formatArgs(tool.args));
  const args = parseArgs(text);
  const error = args.some((arg) => arg.includes('{result}')) ? undefined : 'Include {result}: the file the tool saves the merge to.';
  const save = (): void => {
    if (!error && text !== formatArgs(tool.args)) void setMergeToolArgs(tool, args);
  };
  const customized = tool.origin !== 'custom' && tool.args.join('\0') !== tool.defaultArgs.join('\0');

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>How {tool.name} is opened</h2>
      <div className={styles.argsField}>
        <TextField
          className={styles.args}
          aria-label={`Arguments for ${tool.name}`}
          value={text}
          error={error}
          hint={PLACEHOLDER_HINT}
          onChange={(event) => setText(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => event.key === 'Enter' && save()}
        />
      </div>
      <div className={styles.folderRow}>
        {customized && (
          <Button size="small" variant="ghost" onClick={() => void setMergeToolArgs(tool, null)}>
            Back to its own arguments
          </Button>
        )}
        {tool.origin === 'custom' && (
          <Button size="small" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void removeCustomMergeTool(tool.id)}>
            Remove {tool.name}
          </Button>
        )}
      </div>
    </section>
  );
}
