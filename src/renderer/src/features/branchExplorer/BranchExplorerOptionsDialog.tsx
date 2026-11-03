import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SettingsGroup } from '../../app/settings/SettingsGroup';
import { useBranchExplorerPreferences, useGraphViewOptions } from './branchExplorerStore';
import { DEFAULT_GRAPH_VIEW_OPTIONS, GRAPH_VIEW_OPTION_GROUPS, hidesAnything } from './canvas/graphViewOptions';
import styles from './BranchExplorerOptionsDialog.module.css';

/** Opens the Branch Explorer's display options: what the graph draws. Each change shows at once. */
export function openBranchExplorerOptionsDialog(): void {
  openDialog((close) => <BranchExplorerOptionsDialog onClose={close} />);
}

function BranchExplorerOptionsDialog({ onClose }: { onClose: () => void }) {
  const options = useGraphViewOptions();
  const set = useBranchExplorerPreferences((preferences) => preferences.set);
  return (
    <Dialog
      title="Display options"
      width={360}
      onClose={onClose}
      footer={
        <>
          <Button disabled={!hidesAnything(options)} onClick={() => set(DEFAULT_GRAPH_VIEW_OPTIONS)}>
            Restore defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className={styles.groups}>
        {GRAPH_VIEW_OPTION_GROUPS.map((group) => (
          <SettingsGroup key={group.title} title={group.title}>
            {group.options.map(({ option, label }) => (
              <Checkbox key={option} label={label} checked={options[option]} onChange={(checked) => set({ [option]: checked })} />
            ))}
          </SettingsGroup>
        ))}
      </div>
    </Dialog>
  );
}
