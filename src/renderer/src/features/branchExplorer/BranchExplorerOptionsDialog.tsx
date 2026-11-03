import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SettingsGroup } from '../../app/settings/SettingsGroup';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import { useBranchExplorerPreferences, useExplorerRules, useGraphViewOptions } from './branchExplorerStore';
import { DEFAULT_GRAPH_VIEW_OPTIONS, GRAPH_VIEW_OPTION_GROUPS, hidesAnything } from './canvas/graphViewOptions';
import { ExplorerRulesTab } from './ExplorerRulesTab';
import styles from './BranchExplorerOptionsDialog.module.css';

type OptionsTab = 'display' | 'rules';

const TABS = [
  { value: 'display' as const, label: 'Display' },
  { value: 'rules' as const, label: 'Advanced filters & format' },
];

/** Opens the Branch Explorer's display options: what the graph draws, and the repository's rules. Each change shows at once. */
export function openBranchExplorerOptionsDialog(): void {
  openDialog((close) => <BranchExplorerOptionsDialog onClose={close} />);
}

function BranchExplorerOptionsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<OptionsTab>('display');
  const options = useGraphViewOptions();
  const set = useBranchExplorerPreferences((preferences) => preferences.set);
  return (
    <Dialog
      title="Display options"
      width={tab === 'rules' ? 560 : 400}
      onClose={onClose}
      footer={
        <>
          {tab === 'display' && (
            <Button disabled={!hidesAnything(options)} onClick={() => set(DEFAULT_GRAPH_VIEW_OPTIONS)}>
              Restore defaults
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <SegmentedControl label="Display options" value={tab} segments={TABS} stretch onChange={setTab} />
        {tab === 'display' ? (
          <div className={styles.groups}>
            {GRAPH_VIEW_OPTION_GROUPS.map((group) => (
              <SettingsGroup key={group.title} title={group.title}>
                {group.options.map(({ option, label }) => (
                  <Checkbox key={option} label={label} checked={options[option]} onChange={(checked) => set({ [option]: checked })} />
                ))}
              </SettingsGroup>
            ))}
          </div>
        ) : (
          <RepositoryRules />
        )}
      </div>
    </Dialog>
  );
}

/** The rules of the window's repository: each repository keeps its own. */
function RepositoryRules() {
  const repository = usePlaceRepository();
  const rules = useExplorerRules(repository);
  const setRules = useBranchExplorerPreferences((preferences) => preferences.setRules);
  if (!repository) return null;
  return <ExplorerRulesTab rules={rules} onChange={(changed) => setRules(repository, changed)} />;
}
