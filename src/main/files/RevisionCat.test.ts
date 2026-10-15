import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitsCommandLine } from '../cm/commandLineLimit';
import { catReadsOf, fakeCat } from '../cm/testing/fakeCat';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { MAX_QUICK_CAT, MAX_RUNNING_CATS, RevisionCat, type CatRevision } from './RevisionCat';

const WORKSPACE = join(tmpdir(), 'w');
/** A conflicting file's version, as a merge names it: an item at a changeset of its repository. */
const version = (itemId: number, repository = 'eco@local'): CatRevision => ({ spec: `itemid:${itemId}#cs:5@${repository}`, repository });
/** What the server holds: every item of `eco@local` and `lib@local` but 404, its content naming it. */
const SERVER = fakeCat((spec) => (spec.startsWith('itemid:404#') ? undefined : `content of ${spec}`));

/** Runs the reads asked so far when the test says, as if every IPC call had arrived together. */
function manualSchedule() {
  const runs: (() => void)[] = [];
  return { schedule: (run: () => void) => void runs.push(run), flush: () => runs.splice(0).forEach((run) => run()) };
}

async function setUp(answer: CmAnswer = SERVER) {
  const folder = await mkdtemp(join(tmpdir(), 'revision-cat-'));
  const fake = fakeCmClient({ cat: answer });
  const timing = manualSchedule();
  const cat = new RevisionCat({ cm: fake.cm, schedule: timing.schedule });
  const target = (name: string | number) => join(folder, `v${name}`);
  const save = (revision: CatRevision, name: string | number = revision.spec.split('#')[0]!.slice('itemid:'.length)) => cat.save(WORKSPACE, revision, target(name));
  return { fake, ...timing, cat, target, save, folder };
}

const readsPerCommand = (fake: ReturnType<typeof fakeCmClient>) => fake.commands.map((command) => [command.via, catReadsOf(command.args).length]);

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

  it('reads many revisions asked together in full batches, a process each (a few left over, a quick one), every command line one Windows can start', async () => {
    const { fake, flush, save } = await setUp();
    const saved = Promise.all(Array.from({ length: 1000 }, (_, i) => save(version(1000 + i))));
    flush();
    await saved;
    const perCommand = readsPerCommand(fake);
    expect(perCommand.reduce((total, [, reads]) => total + Number(reads), 0)).toBe(1000);
    expect(perCommand.every(([via, reads]) => via === (Number(reads) > MAX_QUICK_CAT ? 'execute' : 'query'))).toBe(true);
    expect(fake.commands.every((command) => fitsCommandLine(['cat', ...command.args.slice(1)]))).toBe(true);
    // Full batches: as few commands as the command line allows.
    const longest = Math.max(...fake.commands.map((command) => command.args.length - 1));
    expect(fake.commands.length).toBe(Math.ceil(1000 / longest));
  });

  it('runs at most two cm cats at once: the reads asked meanwhile wait, and go together in the next', async () => {
    const releases: (() => void)[] = [];
    let commandAsked = () => {};
    const held: CmAnswer = (command) => {
      commandAsked();
      return new Promise((resolve) => releases.push(() => resolve(SERVER(command))));
    };
    const { fake, flush, save } = await setUp(held);
    const first = [save(version(1)), save(version(2))];
    flush();
    const second = save(version(3));
    flush();
    const meanwhile = Array.from({ length: 10 }, (_, i) => save(version(10 + i)));
    flush();
    expect(fake.commands).toHaveLength(MAX_RUNNING_CATS);
    const third = new Promise<void>((resolve) => (commandAsked = resolve));
    releases.shift()!();
    await Promise.all(first);
    await third;
    releases.splice(0).forEach((release) => release());
    await Promise.all([second, ...meanwhile]);
    expect(readsPerCommand(fake)).toEqual([
      ['query', 2],
      ['query', 1],
      ['execute', 10],
    ]);
  });

  it("reads an xlinked repository's revisions in a command of their own: cm cat resolves each repository on its own", async () => {
    const { fake, flush, save } = await setUp();
    const saved = Promise.all([save(version(1)), save(version(2, 'lib@local'), 'lib2'), save(version(3)), save({ spec: 'serverpath:/a.cs#cs:5', repository: null }, 'a')]);
    flush();
    await saved;
    expect(fake.commands.map((command) => catReadsOf(command.args).map((read) => read.spec))).toEqual([
      ['serverpath:/a.cs#cs:5'],
      ['itemid:1#cs:5@eco@local', 'itemid:3#cs:5@eco@local'],
      ['itemid:2#cs:5@lib@local'],
    ]);
  });

  it("fails a revision cm didn't find alone, with cm's line for it, and keeps the others", async () => {
    const { fake, flush, save, target } = await setUp();
    const reads = [1, 404, 3, 4, 5, 6].map((id) => save(version(id)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
    expect(results[1]).toMatchObject({ reason: { message: 'The specified revision was not found itemid:404#cs:5@eco@local' } });
    expect(await readFile(target(6), 'utf8')).toBe('content of itemid:6#cs:5@eco@local');
    // Those written by the command that failed are read again once, together: never a command each.
    expect(readsPerCommand(fake)).toEqual([
      ['execute', 6],
      ['execute', 5],
    ]);
  });

  it('reads again once, together, the revisions a failed cm cat wrote (one may be cut short), and fails them when it fails again', async () => {
    const cutShort: CmAnswer = async ({ args }) => {
      for (const { target } of catReadsOf(args)) await writeFile(target, 'cut sh');
      return cmFails('Error: The connection was closed');
    };
    const { fake, flush, save, target } = await setUp(cutShort);
    const reads = Array.from({ length: MAX_QUICK_CAT + 1 }, (_, i) => save(version(i + 1)));
    flush();
    const results = await Promise.allSettled(reads);
    expect(results.every((result) => result.status === 'rejected' && /connection was closed/.test(String(result.reason)))).toBe(true);
    expect(readsPerCommand(fake)).toEqual([
      ['execute', MAX_QUICK_CAT + 1],
      ['execute', MAX_QUICK_CAT + 1],
    ]);
    expect(existsSync(target(1))).toBe(true);
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
    const saved = Promise.all([cat.save(WORKSPACE, version(1), target(1)), cat.save(other, version(2), target(2))]);
    flush();
    await saved;
    expect(fake.commands.map((command) => command.options.cwd)).toEqual([WORKSPACE, other]);
  });
});
