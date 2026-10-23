import { ArrowRight, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { RepositoryPicker } from '../../components/RepositoryPicker';
import { classNames } from '../../lib/classNames';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import fieldStyles from '../../ui/Field.module.css';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { TextField } from '../../ui/TextField';
import styles from './XlinkDialog.module.css';
import {
  draftOf,
  withNewRule,
  withoutRule,
  withPointKind,
  withRuleChange,
  xlinkDialogFields,
  type RuleNote,
  type XlinkDialogTarget,
  type XlinkDraft,
  type XlinkPointKind,
} from './xlinkDraft';

const POINT_SEGMENTS: { value: XlinkPointKind; label: string }[] = [
  { value: 'branch', label: 'Branch' },
  { value: 'changeset', label: 'Changeset' },
  { value: 'label', label: 'Label' },
];

/** Opens the dialog; `save` resolves to whether it saved, which closes it. */
export function openXlinkDialog(target: XlinkDialogTarget, save: (draft: XlinkDraft) => Promise<boolean>): void {
  openDialog((close) => <XlinkDialog target={target} save={save} onClose={close} />);
}

function XlinkDialog({ target, save, onClose }: { target: XlinkDialogTarget; save: (draft: XlinkDraft) => Promise<boolean>; onClose: () => void }) {
  const [draft, setDraft] = useState(() => draftOf(target));
  const [saving, setSaving] = useState(false);
  const change = (changes: Partial<XlinkDraft>): void => setDraft((current) => ({ ...current, ...changes }));
  const fields = xlinkDialogFields(target, draft);

  const submit = async (): Promise<void> => {
    if (fields.problem) return;
    setSaving(true);
    const saved = await save(draft);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Dialog
      title={fields.title}
      description={fields.description}
      width={560}
      onClose={onClose}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={Boolean(fields.problem)} loading={saving} data-tip={fields.problem ?? undefined}>
            {fields.saveLabel}
          </Button>
        </>
      }
    >
      {fields.isNew && (
        <>
          <TextField label="Folder name" value={draft.name} placeholder="Engine" autoFocus error={fields.nameError} onChange={(event) => change({ name: event.target.value })} />
          <RepositoryPicker value={draft.repository} onChange={(repository) => change({ repository: repository.spec })} />
        </>
      )}
      <div className={fieldStyles.field}>
        <span className={fieldStyles.label}>Points to</span>
        <SegmentedControl label="Points to" value={draft.pointKind} segments={POINT_SEGMENTS} onChange={(pointKind) => setDraft((current) => withPointKind(target, current, pointKind))} />
      </div>
      <TextField
        label={fields.pointLabel}
        value={draft.point}
        placeholder={fields.pointPlaceholder}
        hint={fields.pointHint}
        error={fields.pointError}
        autoFocus={!fields.isNew}
        onChange={(event) => change({ point: event.target.value })}
      />
      {fields.isNew && (
        <>
          <Checkbox label="Writable: changes made in it are checked in to its repository" checked={draft.writable} onChange={(writable) => change({ writable })} />
          <Checkbox label="Find its repository on the workspace’s server (for replicated repositories)" checked={draft.relativeServer} onChange={(relativeServer) => change({ relativeServer })} />
        </>
      )}
      {fields.showsFolder && (
        <TextField label="Folder of the repository" value={draft.folder} placeholder="/" hint="The xlink shows only this folder." onChange={(event) => change({ folder: event.target.value })} />
      )}
      {fields.showsRules && <ExpansionRules draft={draft} headings={fields.showsRuleHeadings} notes={fields.ruleNotes} onChange={setDraft} />}
    </Dialog>
  );
}

function ExpansionRules({ draft, headings, notes, onChange }: { draft: XlinkDraft; headings: boolean; notes: ReadonlyMap<number, RuleNote>; onChange: (draft: XlinkDraft) => void }) {
  return (
    <div className={fieldStyles.field}>
      <span className={fieldStyles.label}>Branch expansion rules</span>
      <span className={fieldStyles.hint}>Changes made in the xlink while on a branch of this workspace go to the branch of its repository named here.</span>
      {headings && (
        <div className={styles.rules}>
          <div className={styles.row} aria-hidden>
            <span className={styles.columnHeading}>Working on</span>
            <span />
            <span className={styles.columnHeading}>Changes go to</span>
            <span />
          </div>
          {draft.rules.map((rule) => {
            const note = notes.get(rule.key);
            return (
            <div key={rule.key} className={styles.row}>
              <TextField aria-label="Working on" value={rule.from} placeholder="/main/task" onChange={(event) => onChange(withRuleChange(draft, rule.key, { from: event.target.value }))} />
              <ArrowRight size={14} className={styles.arrow} aria-hidden />
              <TextField aria-label="Changes go to" value={rule.to} placeholder="/main/task" onChange={(event) => onChange(withRuleChange(draft, rule.key, { to: event.target.value }))} />
              <IconButton icon={<X size={14} />} label="Remove rule" size="small" onClick={() => onChange(withoutRule(draft, rule.key))} />
              {note && <span className={classNames(note.isError ? fieldStyles.error : fieldStyles.hint, styles.note)}>{note.text}</span>}
            </div>
            );
          })}
        </div>
      )}
      <div>
        <Button size="small" variant="ghost" icon={<Plus size={13} />} onClick={() => onChange(withNewRule(draft))}>
          Add rule
        </Button>
      </div>
    </div>
  );
}
