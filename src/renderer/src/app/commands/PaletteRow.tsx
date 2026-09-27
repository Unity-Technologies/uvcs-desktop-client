import { Command as Cmdk } from 'cmdk';
import { Ellipsis } from 'lucide-react';
import { COPY_ENTRY_IDS } from '../../components/copyMenu';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { runningFirst } from '../../lib/actions';
import { Highlight } from '../../ui/Highlight';
import { Kbd } from '../../ui/Kbd';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { SearchResult } from './searchResults';
import styles from './CommandPalette.module.css';

/** Copying from a row's actions keeps the palette open, as in the branch switcher; every other action closes it first. */
const KEEP_OPEN = COPY_ENTRY_IDS;

interface PaletteRowProps {
  result: SearchResult;
  /** Under the keyboard or the pointer: the only row that offers its actions button. */
  selected: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onRun: () => void;
  /** Runs before any of its actions that leave the palette (closes it). */
  onLeave: () => void;
  /** Takes focus back when the actions menu closes, so typing goes on where it was. */
  onMenuClosed: () => void;
}

/** One result: its icon, the highlighted label with a dimmed detail after it, a status or "current" pill, and its actions (Tab). */
export function PaletteRow({ result, selected, menuOpen, onMenuOpenChange, onRun, onLeave, onMenuClosed }: PaletteRowProps) {
  const Icon = result.icon;
  const showsActions = result.menu && (selected || menuOpen);
  return (
    <Cmdk.Item
      value={result.id}
      className={styles.item}
      data-menu-open={menuOpen}
      disabled={result.disabled}
      onSelect={onRun}
      onContextMenu={(event) => {
        event.preventDefault();
        if (result.menu) onMenuOpenChange(true);
      }}
    >
      <span className={styles.icon}>
        <Icon size={15} className={result.busy ? 'spinning' : undefined} />
      </span>
      <span className={styles.main}>
        <span className={styles.label}>
          {result.labelIsBranch ? (
            <PathLabel path={result.label} matches={result.labelMatches} fitContent />
          ) : (
            <Highlight text={result.label} positions={result.labelMatches} />
          )}
        </span>
        {result.detail && (
          <span className={styles.detail}>
            <Highlight text={result.detail} positions={result.detailMatches} />
          </span>
        )}
      </span>
      {result.isCurrent && <span className={styles.current}>current</span>}
      {result.status && <StatusBadge tone={result.status.tone} title={result.status.title} />}
      {result.shortcut && <Kbd keys={result.shortcut} />}
      {showsActions && (
        <ActionDropdownMenu
          entries={runningFirst(result.menu!(), onLeave, KEEP_OPEN)}
          open={menuOpen}
          onOpenChange={onMenuOpenChange}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onMenuClosed();
          }}
        >
          <button
            type="button"
            tabIndex={-1}
            className={styles.actions}
            aria-label="Actions"
            data-tip="Actions (Tab)"
            // The row runs on click; its actions button must not.
            onClick={(event) => event.stopPropagation()}
          >
            <Ellipsis size={15} />
          </button>
        </ActionDropdownMenu>
      )}
    </Cmdk.Item>
  );
}
