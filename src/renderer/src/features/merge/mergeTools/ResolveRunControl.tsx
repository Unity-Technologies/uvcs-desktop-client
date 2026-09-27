import { Check, ListChecks, Pause, Settings, SkipForward } from 'lucide-react';
import { openSettingsDialogAt } from '../../../app/settings/SettingsDialog';
import { saveSettings, useSettings } from '../../../app/settings/useSettings';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../../lib/actions';
import { isKeyboardTaken } from '../../../lib/mainFocus';
import { hotkey } from '../../../lib/shortcutRegistry';
import { fileNameOf, pluralize } from '../../../lib/text';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { ProgressRing } from '../../../ui/ProgressRing';
import { SplitButton } from '../../../ui/SplitButton';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { leftOutNote, runLabel, runPlans, runPositionText, type RunPlan, type RunProgress } from './resolveRun';
import type { ResolveRun } from './useResolveRun';
import { preferMergeTool, useMergeTools } from './useMergeTools';
import styles from './ResolveRunControl.module.css';

/** Resolving one by one is offered from two files waiting on: for one, the file's own "Resolve in…" says it all. */
const MIN_FILES = 2;

/** The run on offer, if any: what the header's "Resolve N conflicts in <tool>" starts. */
export function useRunOffer(states: FileConflictState[], run: ResolveRun): RunPlan[] {
  const { tools, preferredId } = useMergeTools();
  if (run.progress || states.some((state) => state.openTool)) return [];
  const plans = runPlans(states, tools, preferredId);
  return plans[0] && plans[0].keys.length >= MIN_FILES ? plans : [];
}

interface ResolveRunControlProps {
  states: FileConflictState[];
  run: ResolveRun;
  /** `useRunOffer`: the first is the one the button starts. */
  plans: RunPlan[];
}

/**
 * The merge's primary action while several files wait for the user: "Resolve 5 conflicts in <tool>", one by one.
 * Once started, where the run stands with ways to skip the file or stop.
 */
export function ResolveRunControl({ states, run, plans }: ResolveRunControlProps) {
  const offered = plans[0];
  useShortcut(hotkey('resolveAllInTool'), () => offered && run.start(offered.tool), Boolean(offered));
  if (run.progress) return <RunStrip states={states} run={run} progress={run.progress} />;
  if (!offered) return null;
  return <RunButton plans={plans} run={run} />;
}

function RunButton({ plans, run }: { plans: RunPlan[]; run: ResolveRun }) {
  const { askWhenMergeToolClosesUnsaved } = useSettings();
  const offered = plans[0]!;
  const start = (plan: RunPlan): void => {
    if (plan !== offered) void preferMergeTool(plan.tool.id);
    run.start(plan.tool);
  };
  const menu: MenuEntry[] = tidyMenu([
    ...plans.map((plan) => ({
      id: plan.tool.id,
      label: `${plan.tool.name} · ${pluralize(plan.keys.length, 'conflict')}`,
      icon: plan === offered ? Check : undefined,
      run: () => start(plan),
    })),
    SEPARATOR,
    {
      id: 'askWhenUnsaved',
      label: 'Ask when a file is closed unsaved',
      icon: askWhenMergeToolClosesUnsaved ? Check : undefined,
      run: () => void saveSettings({ askWhenMergeToolClosesUnsaved: !askWhenMergeToolClosesUnsaved }),
    },
    SEPARATOR,
    { id: 'settings', label: 'Merge tool settings…', icon: Settings, run: () => openSettingsDialogAt('merge') },
  ]);
  return (
    <SplitButton
      variant="primary"
      size="medium"
      icon={<ListChecks size={14} />}
      menu={menu}
      menuLabel="Resolve in another tool"
      tip={`Opens each file in ${offered.tool.name} in turn: save and close it there to get the next`}
      tipSub={leftOutNote(offered)}
      shortcut={hotkey('resolveAllInTool')}
      onClick={() => start(offered)}
    >
      {runLabel(offered)}
    </SplitButton>
  );
}

/** "Resolving 2 of 5 · app.ts in FakeMerge [Skip this file] [Stop]", or asking whether to go on after a file closed unsaved. */
function RunStrip({ states, run, progress }: { states: FileConflictState[]; run: ResolveRun; progress: RunProgress }) {
  const current = states.find((state) => state.file.key === progress.currentKey);
  const name = current ? fileNameOf(current.file.path) : '';
  const toolOpen = Boolean(current?.openTool);

  // Esc stops, asking first while the tool has a file: stopping closes it.
  const stopFromKeyboard = async (): Promise<void> => {
    if (isKeyboardTaken()) return;
    if (toolOpen) {
      const sure = await confirm({
        title: 'Stop resolving one by one?',
        message: `${progress.toolName} closes ${name}; what you saved there so far is kept.`,
        confirmLabel: 'Stop',
      });
      if (!sure) return;
    }
    run.stop();
  };
  useShortcut(hotkey('stopResolvingInTool'), () => void stopFromKeyboard());

  if (progress.paused) {
    return (
      <div className={styles.strip} role="status" data-paused>
        <Pause size={14} className={styles.icon} />
        <span className={styles.text}>
          <strong>{name}</strong> closed without saving
          <span className={styles.position}> · {runPositionText(progress)}</span>
        </span>
        <Button size="small" variant="ghost" data-tip-shortcut={hotkey('stopResolvingInTool')} data-tip="Stop resolving one by one" onClick={run.stop}>
          Stop
        </Button>
        <Button size="small" variant="primary" icon={<SkipForward size={13} />} autoFocus onClick={run.proceed}>
          Next file
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.strip} role="status">
      <RunSteps progress={progress} />
      <span className={styles.text}>
        Resolving {runPositionText(progress)}
        <span className={styles.position}>
          {' · '}
          <strong>{name}</strong> in {progress.toolName}
        </span>
      </span>
      <Button size="small" variant="ghost" icon={<SkipForward size={13} />} data-tip={`Closes it in ${progress.toolName} and opens the next file`} onClick={run.skip}>
        Skip this file
      </Button>
      <Button size="small" data-tip={`Closes it in ${progress.toolName}; what you saved there so far is kept`} data-tip-shortcut={hotkey('stopResolvingInTool')} onClick={run.stop}>
        Stop
      </Button>
    </div>
  );
}

/** Most runs are a few files: a step for each (passed, open, to come); a ring beyond what fits. */
const MAX_STEPS = 10;

function RunSteps({ progress }: { progress: RunProgress }) {
  if (progress.total > MAX_STEPS) return <ProgressRing value={progress.position / progress.total} />;
  return (
    <span className={styles.steps} aria-hidden>
      {Array.from({ length: progress.total }, (_, index) => (
        <span key={index} className={styles.step} data-step={index < progress.position ? 'passed' : index === progress.position ? 'open' : 'next'} />
      ))}
    </span>
  );
}
