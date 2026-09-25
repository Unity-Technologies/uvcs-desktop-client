import { listChangeBlocks, type ChangedLine, type DisplayMeta } from './changeBlocks';

export interface DiscardResult {
  text: string;
  /** Where the lines that came back are in the new text (1-based). */
  restoredAt: number[];
}

/**
 * The modified text with some of its changes taken back: the chosen removed lines come back where they were and the
 * chosen added lines go. Within a block, the lines that come back go before the added lines that stay, as a diff
 * shows them. Every line keeps its own line break; one that had none (the end of a file) gets the file's when
 * something now follows it.
 */
export function discardLines(meta: DisplayMeta, lines: ChangedLine[]): DiscardResult {
  const restored = new Set(lines.filter((line) => line.side === 'deletions').map((line) => line.lineNumber));
  const removed = new Set(lines.filter((line) => line.side === 'additions').map((line) => line.lineNumber));
  const result: string[] = [];
  const restoredAt: number[] = [];
  let next = 0;
  for (const block of listChangeBlocks(meta)) {
    // A side with no lines at all numbers its hunk from 0, not 1.
    const newIndex = Math.max(0, block.newStart - 1);
    const oldIndex = Math.max(0, block.oldStart - 1);
    result.push(...meta.additionLines.slice(next, newIndex));
    meta.deletionLines.slice(oldIndex, oldIndex + block.oldLines).forEach((line, offset) => {
      if (!restored.has(oldIndex + offset + 1)) return;
      restoredAt.push(result.push(line));
    });
    meta.additionLines.slice(newIndex, newIndex + block.newLines).forEach((line, offset) => removed.has(newIndex + offset + 1) || result.push(line));
    next = newIndex + block.newLines;
  }
  result.push(...meta.additionLines.slice(next));

  const lineBreak = [...meta.additionLines, ...meta.deletionLines].find((line) => line.endsWith('\n'))?.endsWith('\r\n') ? '\r\n' : '\n';
  const text = result.map((line, index) => (index < result.length - 1 && !line.endsWith('\n') ? line + lineBreak : line)).join('');
  return { text, restoredAt };
}
