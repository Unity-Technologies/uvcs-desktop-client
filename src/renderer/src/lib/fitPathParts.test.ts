import { describe, expect, it } from 'vitest';
import { fitPathParts } from './fitPathParts';
import type { PathPart } from './pathChangeSegments';

const same = (text: string): PathPart => ({ text, changed: false });
const changed = (text: string): PathPart => ({ text, changed: true });
/** One unit a character, as a monospace font would measure. */
const measure = (text: string): number => Array.from(text).length;
const widthOf = (parts: PathPart[]): number => parts.reduce((sum, part) => sum + measure(part.text), 0);

describe('fitPathParts', () => {
  it('keeps a line that fits as it is', () => {
    const parts = [changed('mergeto/'), same('X.cs')];
    expect(fitPathParts(parts, 12, measure)).toEqual(parts);
  });

  it('cuts the unchanged name in its middle, keeping what the move added whole', () => {
    const fitted = fitPathParts([changed('mergeto/fileconflictsresolution/'), same('MatchMergeToFileConflictResolutionsTests.cs')], 52, measure);
    expect(fitted).toEqual([changed('mergeto/fileconflictsresolution/'), same('MatchMerge…sTests.cs')]);
    expect(widthOf(fitted)).toBeLessThanOrEqual(52);
  });

  it('drops whole folders from the middle of an unchanged folder first', () => {
    expect(fitPathParts([same('src/nunit/nunitclient/merge/')], 20, measure)).toEqual([same('src/…/merge/')]);
    expect(fitPathParts([same('src/nunit/nunitclient/'), changed('new/'), same('Name.cs')], 25, measure)).toEqual([same('src/…/'), changed('new/'), same('Name.cs')]);
  });

  it('keeps a third of the line for the name, then drops folders from the middle of what changed', () => {
    const fitted = fitPathParts([changed('tools/build/pipelines/generated/'), same('HumanoidAnimationController.cs')], 45, measure);
    expect(fitted).toEqual([changed('tools/…/pipelines/generated/'), same('Humanoi…ller.cs')]);
    expect(widthOf(fitted)).toBeLessThanOrEqual(45);
  });

  it('cuts a changed folder too short to drop folders from in its middle', () => {
    const fitted = fitPathParts([changed('averyveryverylongnewfolder/'), same('File.cs')], 16, measure);
    expect(fitted).toEqual([changed('avery…lder/'), same('Fi…cs')]);
    expect(widthOf(fitted)).toBeLessThanOrEqual(16);
  });

  it('cuts a long rename in its middle', () => {
    expect(fitPathParts([changed('AnExtremelyLongFileNameThatWasRenamed.cs')], 21, measure)).toEqual([changed('AnExtremel…Renamed.cs')]);
  });

  it('leaves out what is cut to nothing, never going past the room', () => {
    const fitted = fitPathParts([same('a/b/'), changed('c/d/'), same('e.cs')], 1, measure);
    expect(widthOf(fitted)).toBeLessThanOrEqual(1);
    expect(fitted.every((part) => part.text !== '')).toBe(true);
  });
});
