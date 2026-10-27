import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { PING_PERIOD_MS, UsageEvents, type Repeat } from './UsageEvents';

const GAME = join(tmpdir(), 'wkspaces', 'game');
const ART = join(tmpdir(), 'wkspaces', 'art');
const DETAILS = { dark: true, screen: { width: 1920, height: 1080 } };
const PING_LINE = 'trackevent ping --extrainfo=screenresolution=1920x1080:theme=Dark';

/** The repeat the pings were scheduled with: `tick` runs it as an hour going by would, and waits for what it ran. */
function manualRepeat() {
  const scheduled: { run: () => unknown; ms: number; stopped: boolean }[] = [];
  const repeat: Repeat = (run, ms) => {
    const entry = { run, ms, stopped: false };
    scheduled.push(entry);
    return () => {
      entry.stopped = true;
    };
  };
  const tick = () => Promise.all(scheduled.filter((entry) => !entry.stopped).map((entry) => entry.run()));
  return { repeat, scheduled, tick };
}

interface Setup {
  answers?: Record<string, CmAnswer>;
  inFront?: () => string | undefined;
  /** Whether the workspace in front's `cm shell`s answer at once, or were let go while it idled. */
  shellsReady?: () => boolean;
}

function usageEvents({ answers = { trackevent: '' }, inFront = () => GAME, shellsReady = () => true }: Setup = {}) {
  const fake = fakeCmClient(answers);
  const timers = manualRepeat();
  const cm = { query: fake.cm.query, hasReadyShell: shellsReady };
  const usage = new UsageEvents({ cm, workspaceInFront: inFront, pingDetails: () => DETAILS, repeat: timers.repeat });
  return { ...fake, ...timers, usage };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usage events', () => {
  it("records a feature used in the workspace's pooled cm shell, waiting for it: the shell sends what cm stores", async () => {
    const { usage, commands } = usageEvents();

    await usage.featureUsed(GAME, 'checkin');

    expect(commands).toMatchObject([{ via: 'query', line: 'trackevent featureuse checkin', options: { cwd: GAME, inPooledShell: true } }]);
  });

  it('pings as soon as the first workspace shows, its shells just starting, then once an hour, however many show', async () => {
    const { usage, commands, scheduled } = usageEvents({ shellsReady: () => false });

    await usage.workspaceShown(GAME);
    await usage.workspaceShown(ART);

    expect(commands).toMatchObject([{ line: PING_LINE, options: { cwd: GAME, inPooledShell: true } }]);
    expect(scheduled.map((entry) => entry.ms)).toEqual([PING_PERIOD_MS]);
  });

  it('pings each hour for the workspace in front, the one the user works in now', async () => {
    let inFront = GAME;
    const { usage, commands, tick } = usageEvents({ inFront: () => inFront });

    await usage.workspaceShown(GAME);
    inFront = ART;
    await tick();

    expect(commands.map((command) => [command.line, command.options.cwd])).toEqual([
      [PING_LINE, GAME],
      [PING_LINE, ART],
    ]);
  });

  it("skips an hour's ping while no window shows a workspace", async () => {
    let inFront: string | undefined = GAME;
    const { usage, lines, tick } = usageEvents({ inFront: () => inFront });

    await usage.workspaceShown(GAME);
    inFront = undefined;
    await tick();

    expect(lines()).toEqual([PING_LINE]);
  });

  it("skips an hour's ping while the workspace's shells are let go, rather than waking two for it", async () => {
    let ready = true;
    const { usage, lines, tick } = usageEvents({ shellsReady: () => ready });

    await usage.workspaceShown(GAME);
    ready = false;
    await tick();

    expect(lines()).toEqual([PING_LINE]);
  });

  it("stops recording for the session once cm refuses it, as one without trackevent does, without failing", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { usage, lines } = usageEvents({ answers: { trackevent: cmFails('Error: Unknown command trackevent') } });

    await usage.featureUsed(GAME, 'checkin');
    await usage.featureUsed(GAME, 'undo');

    expect(lines()).toEqual(['trackevent featureuse checkin']);
  });

  it('goes on recording after a shell closed under it, as when its window closes', async () => {
    let closed = true;
    const { usage, lines } = usageEvents({
      answers: {
        trackevent: () => {
          if (!closed) return '';
          closed = false;
          throw new Error('cm shell session was closed');
        },
      },
    });

    await usage.featureUsed(GAME, 'undo');
    await usage.featureUsed(GAME, 'checkin');

    expect(lines()).toEqual(['trackevent featureuse undo', 'trackevent featureuse checkin']);
  });

  it('stops pinging once disposed', async () => {
    const { usage, scheduled } = usageEvents();

    await usage.workspaceShown(GAME);
    usage.dispose();

    expect(scheduled.map((entry) => entry.stopped)).toEqual([true]);
  });
});
