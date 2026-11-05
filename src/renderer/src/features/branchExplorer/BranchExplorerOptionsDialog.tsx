import { useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { SettingsGroup } from '../../app/settings/SettingsGroup';
import { usePlaceRepository } from '../../app/workspace/useWorkspace';
import {
  useAppliedExplorerRules,
  useBranchExplorerPreferences,
  useExplorerRules,
  useExplorerRulesOn,
  useGraphViewOptions,
  useUserColorsOn,
} from './branchExplorerStore';
import { DEFAULT_GRAPH_VIEW_OPTIONS, GRAPH_VIEW_OPTION_GROUPS, hidesAnything } from './canvas/graphViewOptions';
import { ChangesetColorsTab } from './ChangesetColorsTab';
import { ExplorerRulesTab } from './ExplorerRulesTab';
import { historyAuthors } from './model/userColors';
import { rememberedPerHistory } from './model/rememberedPerHistory';
import { useBranchExplorerData } from './useBranchExplorerData';
import styles from './BranchExplorerOptionsDialog.module.css';

type OptionsTab = 'display' | 'rules' | 'colors';

const TABS = [
  { value: 'display' as const, label: 'Display' },
  { value: 'rules' as const, label: 'Advanced filters & format' },
  { value: 'colors' as const, label: 'Changeset colors' },
];

/** Pixels: the rules' rows hold conditions, wider than a list of options. */
const TAB_WIDTHS: Record<OptionsTab, number> = { display: 400, rules: 560, colors: 560 };

/**
 * Opens the Branch Explorer's display options: what the graph draws, the repository's rules, and the colors of people's
 * changesets. Each change shows at once.
 */
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
      width={TAB_WIDTHS[tab]}
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
        ) : tab === 'rules' ? (
          <RepositoryRules />
        ) : (
          <ChangesetColors />
        )}
      </div>
    </Dialog>
  );
}

/** The rules of the window's repository: each repository keeps its own. */
function RepositoryRules() {
  const repository = usePlaceRepository();
  const rules = useExplorerRules(repository);
  const on = useExplorerRulesOn(repository);
  const applied = useAppliedExplorerRules(repository);
  const setRules = useBranchExplorerPreferences((preferences) => preferences.setRules);
  const setRulesOn = useBranchExplorerPreferences((preferences) => preferences.setRulesOn);
  if (!repository) return null;
  return (
    <ExplorerRulesTab
      rules={rules}
      on={on}
      applied={applied}
      onChange={(changed) => setRules(repository, changed)}
      onTurn={(turnedOn) => setRulesOn(repository, turnedOn)}
    />
  );
}

/**
 * The colors of people's changesets, the same in every repository, turned on and off in each; people to add come from
 * the history on screen.
 */
function ChangesetColors() {
  const repository = usePlaceRepository();
  const { data } = useBranchExplorerData();
  const colors = useBranchExplorerPreferences((preferences) => preferences.userColors);
  const on = useUserColorsOn(repository);
  const set = useBranchExplorerPreferences((preferences) => preferences.set);
  const setUserColorsOn = useBranchExplorerPreferences((preferences) => preferences.setUserColorsOn);
  const authors = useMemo(() => (data ? rememberedPerHistory(data, 'authors', [], () => historyAuthors(data)) : []), [data]);
  if (!repository) return null;
  return (
    <ChangesetColorsTab
      colors={colors}
      on={on}
      authors={authors}
      onChange={(userColors) => set({ userColors })}
      onTurn={(turnedOn) => setUserColorsOn(repository, turnedOn)}
    />
  );
}
