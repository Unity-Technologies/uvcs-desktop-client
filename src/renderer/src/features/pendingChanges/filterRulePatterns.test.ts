import { describe, expect, it } from 'vitest';
import { countedArray } from '@shared/testing/countedReads';
import { addRulesLabel, canAddRules, itemRulePatterns, rulesFieldRows, rulesFromText, sharedExtension, sharedName } from './filterRulePatterns';

describe('itemRulePatterns', () => {
  it('gives each item a rule from the workspace root', () => {
    expect(itemRulePatterns(['Packages/manifest.json'])).toEqual(['/Packages/manifest.json']);
    expect(itemRulePatterns(['Assets', 'Packages/manifest.json'])).toEqual(['/Assets', '/Packages/manifest.json']);
  });

  it('leaves out the items a selected folder already covers', () => {
    expect(
      itemRulePatterns(['plugin/ProjectSettings', 'plugin/ProjectSettings/AudioManager.asset', 'plugin/ProjectSettings/Deep/Tag.asset', 'plugin/Assets']),
    ).toEqual(['/plugin/ProjectSettings', '/plugin/Assets']);
  });

  it('keeps an item whose name only starts like a selected folder', () => {
    expect(itemRulePatterns(['Assets', 'AssetsBackup/a.png'])).toEqual(['/Assets', '/AssetsBackup/a.png']);
  });

  it('writes each item once, and Unicode names as they are', () => {
    expect(itemRulePatterns(['Música/canción.wav', 'Música/canción.wav'])).toEqual(['/Música/canción.wav']);
  });
});

describe('sharedExtension', () => {
  it('is the extension all the items have', () => {
    expect(sharedExtension(['a/AudioManager.asset', 'b/TagManager.asset'])).toBe('.asset');
  });

  it('is null when they differ, or some have none', () => {
    expect(sharedExtension(['a.asset', 'b.json'])).toBeNull();
    expect(sharedExtension(['ProjectSettings', 'a.asset'])).toBeNull();
    expect(sharedExtension(['ProjectSettings'])).toBeNull();
  });

  // Right-clicking 50,000 selected changes read every path's extension before the menu showed.
  it('stops at the first item whose extension differs', () => {
    const { array: paths, reads } = countedArray(['a.asset', 'b.json', ...Array.from({ length: 1_000 }, (_, index) => `c${index}.asset`)]);
    expect(sharedExtension(paths)).toBeNull();
    expect(reads()).toBe(2);
  });
});

describe('sharedName', () => {
  it('is the name all the items have, wherever they are', () => {
    expect(sharedName(['anewfile.txt2'])).toBe('anewfile.txt2');
    expect(sharedName(['src/New directory', 'tests/New directory'])).toBe('New directory');
    expect(sharedName(['Música/canción.wav', 'Otra/canción.wav'])).toBe('canción.wav');
  });

  it('is null when the names differ', () => {
    expect(sharedName(['a/manifest.json', 'b/package.json'])).toBeNull();
    expect(sharedName([])).toBeNull();
  });

  it('is null for a name a rules file would read as a comment or an exception', () => {
    expect(sharedName(['#notes.txt'])).toBeNull();
    expect(sharedName(['a/!important', 'b/!important'])).toBeNull();
  });

  it('stops at the first item whose name differs', () => {
    const { array: paths, reads } = countedArray(['a/x.asset', 'b/y.asset', ...Array.from({ length: 1_000 }, () => 'c/x.asset')]);
    expect(sharedName(paths)).toBeNull();
    expect(reads()).toBe(2);
  });
});

describe('rulesFromText', () => {
  it('reads a rule from each line, in either line break', () => {
    expect(rulesFromText('/Library\n*.tmp')).toEqual(['/Library', '*.tmp']);
    expect(rulesFromText('/Library\r\n*.tmp\r\n')).toEqual(['/Library', '*.tmp']);
  });

  it('leaves out blank lines, the spaces around a rule and repeated rules', () => {
    expect(rulesFromText('\n  /Temp  \n\n/Temp\n   \n')).toEqual(['/Temp']);
  });

  it('keeps the spaces inside a rule', () => {
    expect(rulesFromText('/New directory')).toEqual(['/New directory']);
  });

  it('is empty when nothing is written', () => {
    expect(rulesFromText('  \n\n')).toEqual([]);
  });
});

describe('addRulesLabel', () => {
  it('counts the rules it adds', () => {
    expect([0, 1, 2, 1200].map(addRulesLabel)).toEqual(['Add rules', 'Add rule', 'Add 2 rules', 'Add 1,200 rules']);
  });
});

describe('rulesFieldRows', () => {
  it('fits the suggested rules and a line more, between 6 and 12 rows', () => {
    expect([1, 5, 8, 11, 500].map(rulesFieldRows)).toEqual([6, 6, 9, 12, 12]);
  });
});

describe('canAddRules', () => {
  it('needs at least one rule', () => {
    expect(canAddRules([])).toBe(false);
    expect(canAddRules(['/Library'])).toBe(true);
  });
});
