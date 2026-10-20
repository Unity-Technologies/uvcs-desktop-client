import { ArrowDownToLine, GitMerge, History } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import { splitComment } from '../../lib/comment';
import { hotkey } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { ResizeHandle } from '../../ui/ResizeHandle';
import { canChangeCheckinMode, checkinButtonLabel, checkinDisabledReason, type CheckinMode } from './checkinButton';
import { CheckinButtonWording } from './CheckinButtonWording';
import { CheckinModeMenu, describeMode } from './CheckinModeMenu';
import { useCheckinDraftStore, useCheckinMessage } from './checkinDraftStore';
import { usePendingChangesViewStore } from './pendingChangesViewStore';
import { describeUpload, type UploadSummary } from './uploadSummary';
import styles from './CheckinPanel.module.css';

const DESCRIPTION_MIN_HEIGHT = 32;
const DESCRIPTION_MAX_HEIGHT = 360;

interface CheckinPanelProps {
  /** The summary field, for the view to put the caret in. */
  summaryRef: RefObject<HTMLInputElement | null>;
  /** Whose draft comment the fields show and edit. */
  workspacePath: string;
  /** How many changes the list holds, private ones too (the header counts only what checks in); undefined until read. */
  listedCount: number | undefined;
  includedCount: number;
  /** What the included changes upload. */
  upload: UploadSummary;
  /** What a shelve takes of the included changes: private files stay out. */
  shelvable: { count: number; upload: UploadSummary };
  branchName: string;
  /** A merge is pending: checking in completes it. */
  merging: boolean;
  /** Changesets on the branch the workspace doesn't have: checking in updates first. */
  behindCount: number;
  /** Under the button while behind, e.g. "1 new changeset from Ana on this branch". */
  behindDescription: string | null;
  /** The changelist whose files alone are checked ("Check in this changelist"), or null. */
  preparedChangelist: string | null;
  /** Review mode is on and every included change is reviewed. */
  allReviewed: boolean;
  recentComments: string[];
  /** Whether the button checks in or shelves: the caret beside it sets it, and so does a changelist's menu. */
  mode: CheckinMode;
  onModeChange: (mode: CheckinMode) => void;
  busy: boolean;
  onCheckin: () => Promise<void>;
  /** `keep`: the changes stay in the workspace; otherwise they are undone once shelved. */
  onShelve: (keep: boolean) => Promise<boolean>;
}

export function CheckinPanel({
  summaryRef,
  workspacePath,
  listedCount,
  includedCount,
  upload,
  shelvable,
  branchName,
  merging,
  behindCount,
  behindDescription,
  preparedChangelist,
  allReviewed,
  recentComments,
  mode,
  onModeChange: setMode,
  busy,
  onCheckin,
  onShelve,
}: CheckinPanelProps) {
  const [keepShelved, setKeepShelved] = useState(false);
  const descriptionHeight = usePendingChangesViewStore((state) => state.descriptionHeight);
  const setDescriptionHeight = usePendingChangesViewStore((state) => state.setDescriptionHeight);
  const { summary, description } = useCheckinMessage(workspacePath);
  const setMessage = useCheckinDraftStore((state) => state.setMessage);
  const onMessageChange = (message: { summary?: string; description?: string }): void => setMessage(workspacePath, message);
  const shelving = mode === 'shelve';
  const count = shelving ? shelvable.count : includedCount;
  const disabledReason = checkinDisabledReason(mode, count, includedCount, listedCount);
  const canAct = disabledReason === null && !busy;
  const { icon: ModeIcon } = describeMode(mode);
  const uploaded = shelving ? shelvable.upload : upload;
  const label = checkinButtonLabel({
    mode,
    listedCount,
    includedCount: count,
    branchName,
    uploadBytes: uploaded.bytes,
    merging,
    behindCount,
    allReviewed,
    keepShelved,
  });
  const updatesFirst = mode === 'checkin' && includedCount > 0 && behindCount > 0 && !merging;

  // A shelve is a detour: once it's done, the panel is back to checking in, and keeping the changes is asked for each time.
  const act = async (): Promise<void> => {
    if (!canAct) return;
    if (mode === 'checkin') await onCheckin();
    else if (await onShelve(keepShelved)) {
      setMode('checkin');
      setKeepShelved(false);
    }
  };
  useShortcut(hotkey('checkin'), () => void act(), canAct);

  // The panel stays on screen while nothing is pending, where the mode caret is disabled: it goes back to checking in.
  useEffect(() => {
    if (listedCount !== 0) return;
    setMode('checkin');
    setKeepShelved(false);
  }, [listedCount]);

  return (
    <div className={styles.panel}>
      <ResizeHandle size={descriptionHeight} min={DESCRIPTION_MIN_HEIGHT} max={DESCRIPTION_MAX_HEIGHT} onResize={setDescriptionHeight} />
      <div className={styles.summaryField}>
        <input
          ref={summaryRef}
          className={styles.summary}
          placeholder={shelving ? 'Shelve summary' : 'Summary'}
          value={summary}
          onChange={(event) => onMessageChange({ summary: event.target.value })}
          spellCheck
        />
        {recentComments.length > 0 && (
          <ActionDropdownMenu
            entries={recentComments.map((recent, index) => ({
              id: `recent.${index}`,
              label: recent.split('\n')[0]!,
              run: () => onMessageChange(splitComment(recent)),
            }))}
          >
            <IconButton size="small" className={styles.recent} icon={<History size={14} />} label="Recent comments" />
          </ActionDropdownMenu>
        )}
      </div>
      <textarea
        className={styles.description}
        placeholder="Description (optional)"
        style={{ height: descriptionHeight }}
        value={description}
        onChange={(event) => onMessageChange({ description: event.target.value })}
        spellCheck
      />
      {shelving && (
        <div className={styles.keep} data-tip="Shelve a copy and keep working on the changes, instead of putting them aside">
          <Checkbox checked={keepShelved} onChange={setKeepShelved} label="Keep the changes here" />
        </div>
      )}
      <div className={styles.actions}>
        {/* aria-disabled rather than disabled, so hovering still shows the tooltip saying why. */}
        <Button
          variant="primary"
          className={styles.act}
          icon={merging && mode === 'checkin' ? <GitMerge size={14} /> : updatesFirst ? <ArrowDownToLine size={14} /> : <ModeIcon size={14} />}
          aria-disabled={!canAct}
          data-tip={disabledReason ?? label.tip}
          data-tip-sub={canAct ? (describeUpload(uploaded) ?? undefined) : undefined}
          data-tip-shortcut={canAct ? hotkey('checkin') : undefined}
          loading={busy}
          onClick={() => void act()}
        >
          <CheckinButtonWording forms={label.forms} />
        </Button>
        <CheckinModeMenu mode={mode} disabled={!canChangeCheckinMode(listedCount, busy)} onChange={setMode} />
      </div>
      {updatesFirst && behindDescription && <div className={styles.behind}>{behindDescription}</div>}
      {preparedChangelist !== null && (
        <div className={styles.prepared} data-tip="Only its files are checked, until they are checked in or shelved">
          Changelist {preparedChangelist}
        </div>
      )}
    </div>
  );
}
