import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { fitsCommandLine } from '../cm/commandLineLimit';
import { catReadsOf, fakeCat, PURGED, purgedRevisionLine } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { MAX_QUICK_BACKLOG, MAX_QUICK_CAT, MAX_RUNNING_CATS, RevisionCat, type CatRevision } from './RevisionCat';

const WORKSPACE = join(tmpdir(), 'w');
/** A conflicting file's version, as a merge names it: an item at a changeset of its repository. */
const version = (itemId: number, repository = 'eco@local'): CatRevision => ({ spec: `itemid:${itemId}#cs:5@${repository}`, repository });
/** A revision by id, as a diff or History names it. */
const revision = (revisionId: number): CatRevision => ({ spec: `revid:${revisionId}@eco@local`, repository: 'eco@local' });
/** What the server holds: every item and revision but 404, its content naming it. */
const SERVER = fakeCat((spec) => (/^(?:itemid|revid):404\b/.test(spec) ? undefined : `content of ${spec}`));
/**
 * A server whose `cm cat` succeeds without writing: what the tests of how hundreds of reads are batched take. A read
 * that succeeded is never looked for on disk, and writing every file took past vitest's 5 s on Windows' CI runners.
 */
const BATCHING_SERVER: typeof SERVER = async () => '';

/** Runs the reads asked so far when the test says, as if every IPC call had arrived together. */
function manualSchedule() {
  const runs: (() => void)[] = [];
  return { schedule: (run: () => void) => void runs.push(run), flush: () => runs.splice(0).forEach((run) => run()) };
}

/** `cm cat` answering only once the test releases it: what runs at once, and what waits, can be told. */
function heldCat(answer: typeof SERVER = SERVER) {
  const releases: (() => void)[] = [];
  let asked: (() => void) | null = null;
  let held = true;
  const cat: CmAnswer = (command) => {
    asked?.();
    if (!held) return answer(command);
    return new Promise((resolve) => releases.push(() => resolve(answer(command))));
  };
  const releaseAll = () => releases.splice(0).forEach((release) => release());
  return {
    cat,
    releaseFirst: () => releases.shift()!(),
    releaseAll,
    /** Answers what waits, and everything asked from now on at once. */
    letAllThrough: () => ((held = false), releaseAll()),
    nextCommand: () => new Promise<void>((resolve) => (asked = resolve)),
  };
}

/** `folder`: a long one makes command lines fill with fewer revisions. */
async function setUp(answer: CmAnswer = SERVER, { longFolder = false } = {}) {
  const base = await mkdtemp(join(tmpdir(), 'revision-cat-'));
  const folder = longFolder ? join(base, 'f'.repeat(200)) : base;
  await mkdir(folder, { recursive: true });
  const fake = fakeCmClient({ cat: answer });
  const timing = manualSchedule();
  const cat = new RevisionCat({ cm: fake.cm, schedule: timing.schedule });
  const target = (name: string | number) => join(folder, `v${name}`);
  const save = (asked: CatRevision, name: string | number = /^\w+:(\d+)/.exec(asked.spec)![1]!) => cat.save(workspacePlace(WORKSPACE), asked, target(name));
  return { fake, ...timing, cat, target, save };
}

const readsPerCommand = (fake: ReturnType<typeof fakeCmClient>) => fake.commands.map((command) => [command.via, catReadsOf(command.args).length]);
const specsPerCommand = (fake: ReturnType<typeof fakeCmClient>) => fake.commands.map((command) => catReadsOf(command.args).map((read) => read.spec));

describe('RevisionCat', () => {
  it('reads a revision asked alone at once, as the one quick cm cat it always was', async () => {
    const { fake, flush, save, target } = await setUp();
    const saved = save(version(1));
    flush();
    await saved;
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['cat', 'itemid:1#cs:5@eco@local', `--file=${target(1)}`], options: { cwd: WORKSPACE } }]);
    expect(await readFile(target(1), 'utf8')).toBe('content of itemid:1#cs:5@eco@local');
  });

  it("reads a few revisions asked together (a conflict's three versions) in one quick cm cat", async () => {
    const { fake, flush, save, target } = await setUp();
    const saved = Promise.all([1, 2, 3].map((id) => save(version(id))));
    flush();
    await saved;
    expect(fake.commands).toMatchObject([{ via: 'query', args: ['cat', `itemid:1#cs:5@eco@local;${target(1)}`, `itemid:2#cs:5@eco@local;${target(2)}`, `itemid:3#cs:5@eco@local;${target(3)}`] }]);
  });

  it("reads a small merge's few dozen versions in quick cm cats one after the other, in one pooled session, never a process", async () => {
    let running = 0;
    let mostAtOnce = 0;
    const counting: CmAnswer = async (command) => {
      mostAtOnce = Math.max(mostAtOnce, ++running);
      await Promise.resolve();
      running--;
      return SERVER(command);
    };
    const { fake, flush, save } = await setUp(counting);
    const saved = Promise.all(Array.from({ length: 30 }, (_, i) => save(version(i + 1))));
    flush();
    await saved;
    expect(fake.linesVia('execute')).toEqual([]);
    expect(readsPerCommand(fake).every(([, reads]) => Number(reads) <= MAX_QUICK_CAT)).toBe(true);
    expect(fake.commands).toHaveLength(Math.ceil(30 / MAX_QUICK_CAT));
    expect(mostAtOnce).toBe(1);
  });

  it('reads a backlog past what quick cm cats serve in full batches, each a process, every command line one Windows can start; the last few quick', async () => {
    const { fake, flush, save } = await setUp(BATCHING_SERVER, { longFolder: true });
    const saved = Promise.all(Array.from({ length: 400 }, (_, i) => save(version(1000 + i))));
    flush();
    await saved;
    const perCommand = readsPerCommand(fake);
    const readsVia = (via: string) => perCommand.filter(([by]) => by === via).map(([, reads]) => Number(reads));
    expect(perCommand.reduce((total, [, reads]) => total + Number(reads), 0)).toBe(400);
    expect(fake.commands.every((command) => fitsCommandLine(command.args))).toBe(true);
    // Full batches, as few as the command line allows, while the backlog is big; what's left goes in quick ones.
    const processes = readsVia('execute');
    expect(processes.length).toBeGreaterThan(1);
    expect(new Set(processes.slice(0, -1)).size).toBe(1);
    expect(readsVia('query').reduce((total, reads) => total + reads, 0)).toBeLessThanOrEqual(MAX_QUICK_BACKLOG);
  });

  it("never holds both pooled sessions: a quick cm cat asked while another runs waits for it, rather than start a process (a diff's sides asked a moment apart)", async () => {
    const held = heldCat();
    const { fake, flush, save } = await setUp(held.cat);
    const first = save(revision(1), 'r1');
    flush();
    const second = save(revision(2), 'r2');
    flush();
    expect(fake.commands).toHaveLength(1);
    const next = held.nextCommand();
    held.releaseFirst();
    await next;
    held.releaseAll();
    await Promise.all([first, second]);
    expect(readsPerCommand(fake)).toEqual([
      ['query', 1],
      ['query', 1],
    ]);
  });

  it('runs at most two cm cats at once: the reads asked meanwhile wait, and the next batch is formed from them as one ends', async () => {
    const held = heldCat(BATCHING_SERVER);
    const { fake, flush, save } = await setUp(held.cat);
    const backlog = (from: number) => Array.from({ length: MAX_QUICK_BACKLOG + 1 }, (_, i) => save(version(from + i)));
    const first = backlog(1000);
    flush();
    const second = backlog(2000);
    flush();
    const meanwhile = backlog(3000);
    flush();
    expect(fake.commands).toHaveLength(MAX_RUNNING_CATS);
    const third = held.nextCommand();
    held.releaseFirst();
    await Promise.all(first);
    await third;
    held.letAllThrough();
    await Promise.all([...second, ...meanwhile]);
    expect(readsPerCommand(fake)).toEqual([
      ['execute', MAX_QUICK_BACKLOG + 1],
      ['execute', MAX_QUICK_BACKLOG + 1],
      ['execute', MAX_QUICK_BACKLOG + 1],
    ]);
  });

  it("reads a revision another view asks for while a merge's versions load in the next cm cat, not after all of them", async () => {
    const held = heldCat(BATCHING_SERVER);
    const { fake, flush, save } = await setUp(held.cat, { longFolder: true });
    const loading = Array.from({ length: 400 }, (_, i) => save(version(1000 + i)));
    flush();
    const historyClick = save(revision(7));
    flush();
    const next = held.nextCommand();
    held.releaseFirst();
    await next;
    expect(fake.commands[MAX_RUNNING_CATS]).toMatchObject({ via: 'query', args: ['cat', 'revid:7@eco@local', expect.stringMatching(/^--file=/)] });
    held.letAllThrough();
    await Promise.all([historyClick, ...loading]);
  });

  it("reads an xlinked repository's revisions, and those by id, in commands of their own", async () => {
    const { fake, flush, save } = await setUp();
    const saved = Promise.all([save(version(1)), save(version(2, 'lib@local'), 'lib2'), save(version(3)), save(revision(7), 'r7'), save({ spec: 'serverpath:/a.cs#cs:5', repository: null }, 'a')]);
    flush();
    await saved;
    expect(specsPerCommand(fake).sort()).toEqual(
      [['itemid:1#cs:5@eco@local', 'itemid:3#cs:5@eco@local'], ['itemid:2#cs:5@lib@local'], ['revid:7@eco@local'], ['serverpath:/a.cs#cs:5']].sort(),
    );
  });

  it("fails a revision cm didn't find alone, with cm's line for it, and keeps the others as written: no command more", async () => {
    const { fake, flush, save, target } = await setUp();
    const reads = [1, 404, 3, 4].map((id) => save(version(id)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
    expect(results[1]).toMatchObject({ reason: { message: 'The specified revision was not found itemid:404#cs:5@eco@local' } });
    expect(await readFile(target(4), 'utf8')).toBe('content of itemid:4#cs:5@eco@local');
    expect(readsPerCommand(fake)).toEqual([['query', 4]]);
  });

  it("fails a purged revision alone, with cm's line for it (which names its file), and keeps the others as written: no command more", async () => {
    const purging = fakeCat((spec) => (spec.startsWith('revid:13@') ? PURGED : `content of ${spec}`));
    const { fake, flush, save, target } = await setUp(purging);
    const reads = [7, 13, 9].map((id) => save(revision(id)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(results[1]).toMatchObject({ reason: { message: purgedRevisionLine(target(13), 13) } });
    expect(await readFile(target(9), 'utf8')).toBe('content of revid:9@eco@local');
    expect(readsPerCommand(fake)).toEqual([['query', 3]]);
  });

  it('finds the one spec that failed a whole cm cat before it wrote anything, saying nothing of it, in halves: every other read is saved', async () => {
    const refusing: CmAnswer = (command) => (catReadsOf(command.args).some((read) => read.spec.startsWith('itemid:13#')) ? cmFails('Error: Incorrect object specification') : SERVER(command));
    const { fake, flush, save } = await setUp(refusing);
    const reads = Array.from({ length: MAX_QUICK_BACKLOG + 1 }, (_, i) => save(version(i + 1)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([{ status: 'rejected', reason: expect.objectContaining({ message: 'Incorrect object specification' }) }]);
    // The batch, then two halves at each halving: never a command each.
    expect(fake.commands.length).toBeLessThanOrEqual(1 + 2 * Math.ceil(Math.log2(MAX_QUICK_BACKLOG + 1)));
  });

  it('fails the reads of a cm cat that failed for them all (a dropped connection) after trying its halves once, never one by one', async () => {
    const cutShort: CmAnswer = async ({ args }) => {
      for (const { target } of catReadsOf(args)) await writeFile(target, 'cut sh');
      return cmFails('Error: The connection was closed');
    };
    const { fake, flush, save } = await setUp(cutShort);
    const reads = Array.from({ length: MAX_QUICK_BACKLOG + 2 }, (_, i) => save(version(i + 1)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.every((result) => result.status === 'rejected' && /connection was closed/.test(String(result.reason)))).toBe(true);
    const half = (MAX_QUICK_BACKLOG + 2) / 2;
    expect(readsPerCommand(fake).map(([, reads]) => reads)).toEqual([MAX_QUICK_BACKLOG + 2, half, half]);
  });

  it("reads again, alone, the one revision a failure left unexplained, rather than fail it with another's error", async () => {
    let first = true;
    const confused: CmAnswer = (command) => {
      if (!first) return SERVER(command);
      first = false;
      return cmFails('The specified revision was not found revid:404@eco@local\nError: The connection was reset');
    };
    const { flush, save } = await setUp(confused);
    const sides = [save(revision(404)), save(revision(7))];
    flush();
    const [gone, kept] = await Promise.allSettled(sides);
    expect(gone).toMatchObject({ status: 'rejected', reason: { message: 'The specified revision was not found revid:404@eco@local' } });
    expect(kept).toEqual({ status: 'fulfilled', value: undefined });
  });

  it("keeps a diff's side cm wrote when the other side failed with an error that doesn't name it", async () => {
    const oneSideGone: CmAnswer = async (command) => {
      for (const { spec, target } of catReadsOf(command.args)) if (spec !== 'revid:404@eco@local') await writeFile(target, `content of ${spec}`);
      return catReadsOf(command.args).some((read) => read.spec === 'revid:404@eco@local') ? cmFails('Error: The specified item /a.cs does not exist.') : '';
    };
    const { flush, save } = await setUp(oneSideGone);
    const sides = [save(revision(7)), save(revision(404))];
    flush();
    const [healthy, gone] = await Promise.allSettled(sides);
    expect(healthy).toEqual({ status: 'fulfilled', value: undefined });
    expect(gone).toMatchObject({ status: 'rejected', reason: { message: 'The specified item /a.cs does not exist.' } });
  });

  it("fails a revision read alone with cm's own failure", async () => {
    const { flush, save } = await setUp();
    const saved = save(version(404));
    flush();
    await expect(saved).rejects.toThrow('The specified revision was not found itemid:404#cs:5@eco@local');
  });

  it('reads each workspace in commands of its own, run in it', async () => {
    const { fake, flush, cat, target } = await setUp();
    const other = join(tmpdir(), 'other');
    const saved = Promise.all([cat.save(workspacePlace(WORKSPACE), version(1), target(1)), cat.save(workspacePlace(other), version(2), target(2))]);
    flush();
    await saved;
    expect(fake.commands.map((command) => command.options.cwd)).toEqual([WORKSPACE, other]);
  });

  it('reads a repository with no workspace apart, outside every workspace', async () => {
    const { fake, flush, cat, target } = await setUp();
    const saved = Promise.all([cat.save(workspacePlace(WORKSPACE), version(1), target(1)), cat.save(repositoryPlace('eco@local'), version(2), target(2))]);
    flush();
    await saved;
    expect(fake.commands.map((command) => command.options)).toEqual([{ cwd: WORKSPACE }, { outsideWorkspaces: true }]);
  });
});
