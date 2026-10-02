import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PermissionTarget } from '@shared/domain/permissions';
import { hotkey } from '../../lib/shortcutRegistry';
import { matchesShortcut } from '../../lib/shortcuts';
import { Button } from '../../ui/Button';
import { confirm } from '../../ui/dialog/confirm';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { ListSkeleton } from '../../ui/Skeleton';
import { TextField } from '../../ui/TextField';
import { changeLines } from './changeWords';
import { askPathBranchEdits } from './EditPathBranchesDialog';
import { editPathBranches, parseBranchList, removePathPermissions } from './pathPermissionOperations';
import { PathScope } from './PathScope';
import { PermissionsEditor } from './PermissionsEditor';
import { useMemberNames, usePermissions } from './permissionsQueries';
import { changeCount, draftChanges, EMPTY_DRAFT, setOwner, undoMember, type PermissionsDraft } from './permissionsDraft';
import { describeTarget } from './permissionTargets';
import { savePermissions } from './savePermissions';
import styles from './PermissionsDialog.module.css';

export interface PermissionsDialogOptions {
  target: PermissionTarget;
  /** The workspace it's opened from, whose lists show owners; none from the home screen. */
  workspacePath?: string;
}

/** Opens the permissions of a server, repository, branch, label, attribute or path. */
export function openPermissionsDialog(options: PermissionsDialogOptions): void {
  openDialog((close) => <PermissionsDialog {...options} onClose={close} />);
}

const changesWord = (count: number) => (count === 1 ? '1 change' : `${count} changes`);

function PermissionsDialog({ target: opened, workspacePath, onClose }: PermissionsDialogOptions & { onClose: () => void }) {
  const [target, setTarget] = useState(opened);
  const [draft, setDraft] = useState<PermissionsDraft>(EMPTY_DRAFT);
  const [newBranches, setNewBranches] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const permissionsQuery = usePermissions(target);
  const groupsQuery = useMemberNames(target.server, 'group');
  const permissions = permissionsQuery.data;
  const groups = useMemo(() => new Set(groupsQuery.data ?? []), [groupsQuery.data]);

  const changes = useMemo(() => (permissions ? draftChanges(permissions, draft) : { entries: [] }), [permissions, draft]);
  const count = changeCount(changes);
  const isNewGroup = target.kind === 'path' && Boolean(target.tag) && permissions?.ownAcl === false;
  const branches = parseBranchList(newBranches);
  const canSave = count > 0 && !saving && (!isNewGroup || branches.length > 0);

  /** Runs `then` once any changes not saved are confirmed gone. */
  const leaving = async (then: () => void): Promise<void> => {
    if (count > 0 && !(await confirm({ title: `Discard ${changesWord(count)}?`, message: 'They haven’t been saved.', confirmLabel: 'Discard', danger: true }))) return;
    then();
  };

  const show = (next: PermissionTarget): void =>
    void leaving(() => {
      setTarget(next);
      setDraft(EMPTY_DRAFT);
      setNewBranches('');
    });

  const save = async (): Promise<void> => {
    if (!canSave || !permissions) return;
    setSaving(true);
    const saved = await savePermissions({ target, permissions, changes, branches: isNewGroup ? branches : undefined, workspacePath });
    setSaving(false);
    if (saved) onClose();
  };

  const changeGroupBranches = async (): Promise<void> => {
    const edits = target.tag ? await askPathBranchEdits(target.tag) : undefined;
    if (edits) await editPathBranches(target, edits.add, edits.remove);
  };

  const removePath = async (): Promise<void> => {
    if (await removePathPermissions(target)) setDraft(EMPTY_DRAFT);
  };

  // A modal dialog keeps the window's shortcuts from running (`windowShortcutMayRun`): saving is bound to this
  // dialog's keys, wherever its focus is (the footer too), and not to a dialog opened over it.
  const latestSave = useRef(save);
  latestSave.current = save;
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      const dialog = bodyRef.current?.closest('[role="dialog"]');
      if (!dialog?.contains(event.target as Node) || !matchesShortcut(event, hotkey('savePermissions'))) return;
      event.preventDefault();
      void latestSave.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const loadError = permissionsQuery.error ?? groupsQuery.error;
  const secured = target.kind === 'path' && permissions?.ownAcl === true;

  return (
    <Dialog
      title="Permissions"
      description={describeTarget(target)}
      width={1000}
      onClose={() => void leaving(onClose)}
      footer={
        <div className={styles.footer}>
          <span className={styles.footerStart}>
            {secured && (
              <Button variant="ghost" size="small" onClick={() => void removePath()}>
                Remove path permissions…
              </Button>
            )}
            {secured && target.tag && (
              <Button variant="ghost" size="small" onClick={() => void changeGroupBranches()}>
                Branches of {target.tag}…
              </Button>
            )}
            {count > 0 && (
              <Button variant="ghost" size="small" icon={reviewing ? <ChevronDown size={14} /> : <ChevronRight size={14} />} aria-expanded={reviewing} onClick={() => setReviewing(!reviewing)}>
                {changesWord(count)}
              </Button>
            )}
          </span>
          <Button onClick={() => void leaving(onClose)}>Cancel</Button>
          <Button variant="primary" disabled={!canSave} loading={saving} data-tip={canSave ? undefined : count > 0 ? 'Name the branches of the new group first' : 'Nothing changed yet'} data-tip-shortcut={hotkey('savePermissions')} onClick={() => void save()}>
            {count > 1 ? `Save ${changesWord(count)}` : 'Save'}
          </Button>
        </div>
      }
    >
      <div ref={bodyRef} className={styles.body}>
        {target.kind === 'path' && <PathScope target={target} onShow={show} />}
        {isNewGroup && (
          <TextField
            label={`Branches of ${target.tag}`}
            value={newBranches}
            hint="Full names, apart by commas: /main, /main/release"
            onChange={(event) => setNewBranches(event.target.value)}
          />
        )}
        {loadError ? (
          <EmptyState
            title="Couldn't read the permissions"
            description={loadError.message}
            action={
              <Button
                onClick={() => {
                  void permissionsQuery.refetch();
                  void groupsQuery.refetch();
                }}
              >
                Try again
              </Button>
            }
          />
        ) : permissions && groupsQuery.data ? (
          <PermissionsEditor key={`${target.name}#${target.tag ?? ''}`} target={target} permissions={permissions} groups={groups} draft={draft} onDraft={setDraft} />
        ) : (
          <div className={styles.loading} aria-busy="true" aria-label="Loading">
            <ListSkeleton rowHeight={34} />
          </div>
        )}
        {reviewing && count > 0 && (
          <section className={styles.review} aria-label="Changes not saved yet">
            {changeLines(changes).map((line) => (
              <div key={line.name ?? 'owner'} className={styles.reviewLine}>
                <span className={styles.reviewMember}>{line.member}</span>
                <span className={styles.reviewText}>{line.text}</span>
                <IconButton
                  icon={<RotateCcw size={13} />}
                  label="Undo this change"
                  size="small"
                  onClick={() => setDraft(line.name === null ? setOwner(draft, undefined) : undoMember(draft, line.name))}
                />
              </div>
            ))}
          </section>
        )}
      </div>
    </Dialog>
  );
}
