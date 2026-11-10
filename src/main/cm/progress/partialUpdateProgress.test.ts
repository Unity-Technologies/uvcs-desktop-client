import { describe, expect, it } from 'vitest';
import { readPartialUpdateProgress } from './partialUpdateProgress';
import { readProgress } from './testing/readProgress';

/**
 * `cm partial update` as it prints with piped stdout: a sentence, then a line every second, "Calculating..." until the
 * totals are known, then the bytes, files and operations done, with the item being written after " - ".
 */
const UPDATE = [
  'Unity VCS is updating your workspace. Wait a moment, please...',
  'Calculating...',
  'Calculating...',
  'Updated 0 bytes of 243.76 MB (0 of 17 files to download / 0 of 33 operations to apply)',
  'Updated 116.26 MB of 243.76 MB (8 of 17 files to download / 8 of 33 operations to apply) - /Assets/Textures/rock.png',
  'Updated 243.76 MB of 243.76 MB (17 of 17 files to download / 20 of 33 operations to apply) - /Assets/Scenes',
  'Updated 243.76 MB of 243.76 MB (17 of 17 files to download / 33 of 33 operations to apply)',
];

const MB = 1024 ** 2;
/** What each file and operation weighs in besides the bytes. */
const ITEM = 128 * 1024;

describe('readPartialUpdateProgress', () => {
  it('prepares, cancellable, on its first sentence', () => {
    expect(readProgress(readPartialUpdateProgress, UPDATE.slice(0, 1))).toEqual({
      stage: 'preparing',
      stageLabel: 'Preparing',
      fraction: null,
      cancellable: true,
    });
  });

  it('calculates until the totals are known', () => {
    expect(readProgress(readPartialUpdateProgress, UPDATE.slice(0, 3))).toEqual({
      stage: 'calculating',
      stageLabel: 'Calculating changes',
      fraction: null,
      cancellable: true,
    });
  });

  it('reads bytes, files and the item being written while downloading, and stops offering to cancel', () => {
    expect(readProgress(readPartialUpdateProgress, UPDATE.slice(0, 5))).toEqual({
      stage: 'downloading',
      stageLabel: 'Downloading',
      current: 8,
      total: 17,
      bytesDone: Math.round(116.26 * MB),
      bytesTotal: Math.round(243.76 * MB),
      fraction: expect.closeTo((116.26 * MB + 16 * ITEM) / (243.76 * MB + 50 * ITEM), 6),
      currentItem: '/Assets/Textures/rock.png',
      cancellable: false,
    });
  });

  it('applies the operations left once every file is downloaded', () => {
    expect(readProgress(readPartialUpdateProgress, UPDATE.slice(0, 6))).toMatchObject({
      stage: 'applying',
      stageLabel: 'Applying changes',
      current: 17,
      total: 17,
      currentItem: '/Assets/Scenes',
      cancellable: false,
    });
  });

  it('finishes once every file and operation is done', () => {
    expect(readProgress(readPartialUpdateProgress, UPDATE)).toMatchObject({ stage: 'finishing', stageLabel: 'Finishing', fraction: 1 });
  });

  it('only moves forwards, and ends full', () => {
    const fractions = UPDATE.map((_, index) => readProgress(readPartialUpdateProgress, UPDATE.slice(0, index + 1))?.fraction ?? 0);
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b));
    expect(fractions.at(-1)).toBe(1);
  });

  it('keeps its progress through a later bare line ("Updating..." when nothing is left to download, an error)', () => {
    expect(readProgress(readPartialUpdateProgress, [...UPDATE.slice(0, 5), 'Updating...'])).toMatchObject({ stage: 'downloading', current: 8 });
    expect(readProgress(readPartialUpdateProgress, [...UPDATE, 'The item /Assets/a.txt is locked'])).toMatchObject({ stage: 'finishing' });
  });

  // The words are localized, so a switch's first "Calculating..." (it prints no sentence before) can't be told from an
  // update's sentence: it reads as preparing for a second, both cancellable with no fraction.
  it('switches, with no first sentence, calculate from their second line', () => {
    expect(readProgress(readPartialUpdateProgress, ['Calculating...', 'Calculating...'])).toMatchObject({ stage: 'calculating' });
  });

  it('reads localized output by its shape, decimal commas included', () => {
    const line = 'Actualizado 1,5 MB de 3 MB (2 de 4 archivos a descargar / 2 de 4 operaciones a aplicar) - /a.txt';
    expect(readProgress(readPartialUpdateProgress, ['Calculando...', line])).toMatchObject({
      stage: 'downloading',
      bytesDone: Math.round(1.5 * MB),
      bytesTotal: 3 * MB,
      current: 2,
      total: 4,
      currentItem: '/a.txt',
    });
  });

  it('reads sizes in bytes and gigabytes', () => {
    expect(readProgress(readPartialUpdateProgress, ['Updated 512 bytes of 1.2 GB (1 of 3 files to download / 1 of 3 operations to apply)'])).toMatchObject({
      bytesDone: 512,
      bytesTotal: Math.round(1.2 * 1024 ** 3),
    });
  });
});
