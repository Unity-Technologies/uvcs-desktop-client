import { Check, GalleryVerticalEnd, Pause, Settings, SkipForward } from 'lucide-react';
import { usePageShown } from '../../../app/navigation/pageShown';
import { openSettingsDialogAt } from '../../../app/settings/SettingsDialog';
import { saveSettings, useSettings } from '../../../app/settings/useSettings';
import { SEPARATOR, tidyMenu, type MenuEntry } from '../../../lib/actions';
import { isKeyboardTaken } from '../../../lib/mainFocus';
import { hotkey } from '../../../lib/shortcutRegistry';
import { fileNameOf } from '../../../lib/text';
import { useShortcut } from '../../../lib/useShortcut';
import { Button } from '../../../ui/Button';
import { confirm } from '../../../ui/dialog/confirm';
import { ProgressRing } from '../../../ui/ProgressRing';
import { SplitButton } from '../../../ui/SplitButton';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { allInChoices, leftOutNote, runLabel, runPlans, runPositionText, runStripWords, runTip, type RunPlan, type RunProgress } from './resolveRun';
import type { ResolveRun } from './useResolveRun';
import { toolChoiceEntries } from './toolChoices';
import { useFileMergers, useMergeTools } from './useMergeTools';
import styles from './ResolveRunControl.module.css';

/** Resolving one by one is offered from two files waiting on: for one, the file's own "Resolve in…" says it all. */
const MIN_FILES = 2;

/**
 * The runs on offer, if any: the first is what the header's "Resolve N conflicts" starts, each file in its own tool;
 * the others, every file in one tool.
 */
export function useRunOffer(states: FileConflictState[], run: ResolveRun): RunPlan[] {
  const { tools } = useMergeTools();
  const { mergerFor } = useFileMergers();
  if (run.progress || states.some((state) => state.openTool)) return [];
  const plans = runPlans(states, tools, mergerFor);
  return plans[0] && plans[0].steps.length >= MIN_FILES ? plans : [];
}

interface ResolveRunControlProps {
  states: FileConflictState[];
  run: ResolveRun;
  /** `useRunOffer`: the first is the one the button starts; the others, every file in one tool, behind its caret. */
  plans: RunPlan[];
}

/**
 * The merge's primary action while several files wait for the user: "Resolve 5 conflicts in <tool>", one by one.
 * Once started, where the run stands with ways to skip the file or stop.
 */
export function ResolveRunControl({ states, run, plans }: ResolveRunControlProps) {
  const offered = plans[0];
  const shown = usePageShown();
  useShortcut(hotkey('resolveAllInTool'), () => offered && run.start(null), Boolean(offered) && shown);
  if (run.progress) return <RunStrip states={states} run={run} progress={run.progress} />;
  if (!offered) return null;
  return <RunButton plans={plans} run={run} />;
}

function RunButton({ plans, run }: { plans: RunPlan[]; run: ResolveRun }) {
  const { askWhenMergeToolClosesUnsaved } = useSettings();
  const offered = plans[0]!;
  // The caret starts the run with every file in one tool, this once; the button, each file in its own.
  const menu: MenuEntry[] = tidyMenu([
    ...toolChoiceEntries(allInChoices(plans), (merger) => run.start(merger)),
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
      icon={<GalleryVerticalEnd size={14} />}
      menu={menu}
      menuLabel="Resolve in another tool"
      tip={runTip(offered)}
      tipSub={leftOutNote(offered)}
      shortcut={hotkey('resolveAllInTool')}
      onClick={() => run.start(null)}
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
  // Smart Merge merges a Unity asset before the tool would open on it.
  const words = runStripWords(progress.toolName, current?.openTool?.toolName);

  // Esc stops, asking first while the tool has a file: stopping closes it. Smart Merge has nothing to lose.
  const shown = usePageShown();
  const stopFromKeyboard = async (): Promise<void> => {
    if (isKeyboardTaken()) return;
    if (toolOpen && words.confirmsStop) {
      const sure = await confirm({
        title: 'Stop resolving one by one?',
        message: `${words.toolName} closes ${name}; what you saved there so far is kept.`,
        confirmLabel: 'Stop',
      });
      if (!sure) return;
    }
    run.stop();
  };
  useShortcut(hotkey('stopResolvingInTool'), () => void stopFromKeyboard(), shown);

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
          <strong>{name}</strong> {words.where}
        </span>
      </span>
      <Button size="small" variant="ghost" icon={<SkipForward size={13} />} data-tip={words.skipTip} onClick={run.skip}>
        Skip this file
      </Button>
      <Button size="small" data-tip={words.stopTip} data-tip-shortcut={hotkey('stopResolvingInTool')} onClick={run.stop}>
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
