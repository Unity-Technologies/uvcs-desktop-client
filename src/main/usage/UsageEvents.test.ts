import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { PING_PERIOD_MS, UsageEvents, type Repeat } from './UsageEvents';

const GAME = join(tmpdir(), 'wkspaces', 'game');
const ART = join(tmpdir(), 'wkspaces', 'art');
const DETAILS = { dark: true, screen: { width: 1920, height: 1080 } };
const PING_LINE = 'trackevent ping --extrainfo=theme=Dark:screenresolution=1920x1080';

/** The repeat the pings were scheduled with: `tick` runs it as an hour going by would. */
function manualRepeat() {
  const scheduled: { run: () => void; ms: number; stopped: boolean }[] = [];
  const repeat: Repeat = (run, ms) => {
    const entry = { run, ms, stopped: false };
    scheduled.push(entry);
    return () => {
      entry.stopped = true;
    };
  };
  return { repeat, scheduled, tick: () => scheduled.filter((entry) => !entry.stopped).forEach((entry) => entry.run()) };
}

function usageEvents(answers: Record<string, CmAnswer> = { trackevent: '' }, workspaceInFront: () => string | undefined = () => GAME) {
  const fake = fakeCmClient(answers);
  const timers = manualRepeat();
  const usage = new UsageEvents({ cm: fake.cm, workspaceInFront, pingDetails: () => DETAILS, repeat: timers.repeat });
  return { ...fake, ...timers, usage };
}

/** Lets the commands asked without being awaited settle. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usage events', () => {
  it("records a feature used with one quick command in the workspace's cm shell", async () => {
    const { usage, commands } = usageEvents();

    usage.featureUsed(GAME, 'checkin');
    await settled();

    expect(commands).toMatchObject([{ via: 'query', line: 'trackevent featureuse checkin', options: { cwd: GAME } }]);
  });

  it('pings as soon as the first workspace shows, then once an hour, and only once however many show', async () => {
    const { usage, lines, scheduled } = usageEvents();

    usage.workspaceShown(GAME);
    usage.workspaceShown(ART);
    await settled();

    expect(lines()).toEqual([PING_LINE]);
    expect(scheduled.map((entry) => entry.ms)).toEqual([PING_PERIOD_MS]);
  });

  it('pings each hour for the workspace in front, the one the user works in now', async () => {
    let inFront = GAME;
    const { usage, commands, tick } = usageEvents(undefined, () => inFront);

    usage.workspaceShown(GAME);
    inFront = ART;
    tick();
    await settled();

    expect(commands.map((command) => [command.line, command.options.cwd])).toEqual([
      [PING_LINE, GAME],
      [PING_LINE, ART],
    ]);
  });

  it("skips an hour's ping while no window shows a workspace", async () => {
    let inFront: string | undefined = GAME;
    const { usage, lines, tick } = usageEvents(undefined, () => inFront);

    usage.workspaceShown(GAME);
    inFront = undefined;
    tick();
    await settled();

    expect(lines()).toEqual([PING_LINE]);
  });

  it("stops recording for the session after a failure, as with a cm that doesn't know trackevent, without failing", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { usage, lines } = usageEvents({ trackevent: cmFails('Error: Unknown command trackevent') });

    usage.featureUsed(GAME, 'checkin');
    await settled();
    usage.featureUsed(GAME, 'undo');
    await settled();

    expect(lines()).toEqual(['trackevent featureuse checkin']);
  });

  it('stops pinging once disposed', () => {
    const { usage, scheduled } = usageEvents();

    usage.workspaceShown(GAME);
    usage.dispose();

    expect(scheduled.map((entry) => entry.stopped)).toEqual([true]);
  });
});
