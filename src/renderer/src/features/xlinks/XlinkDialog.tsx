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
import { TextArea, TextField } from '../../ui/TextField';
import { PickField } from './PickField';
import styles from './XlinkDialog.module.css';
import {
  draftOf,
  withNewRule,
  withoutRule,
  withPointKind,
  withRuleChange,
  xlinkDialogFields,
  type XlinkDialogFields,
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
      <PickField
        label={fields.pointLabel}
        value={draft.point}
        placeholder={fields.pointPlaceholder}
        hint={fields.pointHint}
        error={fields.pointError}
        autoFocus={!fields.isNew}
        source={fields.pointSource}
        onChange={(point) => change({ point })}
      />
      {fields.isNew && (
        <>
          <Checkbox label="Writable: changes made in it are checked in to its repository" checked={draft.writable} onChange={(writable) => change({ writable })} />
          <Checkbox label="Find its repository on the workspace’s server (for replicated repositories)" checked={draft.relativeServer} onChange={(relativeServer) => change({ relativeServer })} />
        </>
      )}
      {fields.showsFolder && (
        <PickField label="Folder of the repository" value={draft.folder} placeholder="/" hint="The xlink shows only this folder." source={fields.folderSource} onChange={(folder) => change({ folder })} />
      )}
      {fields.showsRules && <ExpansionRules draft={draft} fields={fields} update={setDraft} />}
      {fields.isNew && <TextArea label="Comment" value={draft.comment} placeholder={fields.commentPlaceholder} onChange={(event) => change({ comment: event.target.value })} />}
    </Dialog>
  );
}

/** `update` takes a change of the latest draft: a branch picked from a list arrives after other typing. */
function ExpansionRules({ draft, fields, update }: { draft: XlinkDraft; fields: XlinkDialogFields; update: (change: (current: XlinkDraft) => XlinkDraft) => void }) {
  return (
    <div className={fieldStyles.field}>
      <span className={fieldStyles.label}>Branch expansion rules</span>
      <span className={fieldStyles.hint}>Changes made in the xlink while on a branch of this workspace go to the branch of its repository named here.</span>
      {fields.showsRuleHeadings && (
        <div className={styles.rules}>
          <div className={styles.row} aria-hidden>
            <span className={styles.columnHeading}>Working on</span>
            <span />
            <span className={styles.columnHeading}>Changes go to</span>
            <span />
          </div>
          {draft.rules.map((rule) => {
            const note = fields.ruleNotes.get(rule.key);
            return (
            <div key={rule.key} className={styles.row}>
              <PickField aria-label="Working on" value={rule.from} placeholder="/main/task" source={fields.workspaceBranches} onChange={(from) => update((current) => withRuleChange(current, rule.key, { from }))} />
              <ArrowRight size={14} className={styles.arrow} aria-hidden />
              <PickField aria-label="Changes go to" value={rule.to} placeholder="/main/task" source={fields.xlinkedBranches} onChange={(to) => update((current) => withRuleChange(current, rule.key, { to }))} />
              <IconButton icon={<X size={14} />} label="Remove rule" size="small" onClick={() => update((current) => withoutRule(current, rule.key))} />
              {note && <span className={classNames(note.isError ? fieldStyles.error : fieldStyles.hint, styles.note)}>{note.text}</span>}
            </div>
            );
          })}
        </div>
      )}
      <div>
        <Button size="small" variant="ghost" icon={<Plus size={13} />} onClick={() => update(withNewRule)}>
          Add rule
        </Button>
      </div>
    </div>
  );
}
