import { describe, expect, it } from 'vitest';
import { judgeToolResult } from './toolResult';

const run = { exitCode: 0, errorOutput: '', seconds: 30 };
const bytes = (text: string): Buffer => Buffer.from(text);

describe('judgeToolResult', () => {
  const text = { start: bytes('<<<<<<< a\n=======\n>>>>>>> b\n') };

  it('takes the saved text, whatever the exit code says', () => {
    expect(judgeToolResult({ ...text, result: bytes('a\nb\n') }, { exitCode: null, errorOutput: '', seconds: 30 })).toEqual({ kind: 'resolved', text: 'a\nb\n' });
  });

  it('sees nothing resolved when the result is as it started, or gone', () => {
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 1, errorOutput: 'closed', seconds: 30 })).toEqual({ kind: 'unchanged', exitCode: 1, errorOutput: 'closed' });
    expect(judgeToolResult({ ...text, result: null }, run)).toMatchObject({ kind: 'unchanged' });
  });

  it('fails a tool that exits at once with an error, saying why, instead of taking it as closed unsaved', () => {
    const license = 'You have not agreed to the Xcode license agreements. Please run \'sudo xcodebuild -license\'.';
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 69, errorOutput: `warning\n${license}\n`, seconds: 0.2 })).toEqual({ kind: 'failed', message: license });
    // Closed by the user: it took a while, or it said nothing, or it exited as usual.
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 1, errorOutput: 'closed', seconds: 8 })).toMatchObject({ kind: 'unchanged' });
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 1, errorOutput: '', seconds: 1 })).toMatchObject({ kind: 'unchanged' });
    expect(judgeToolResult({ ...text, result: text.start }, { exitCode: 0, errorOutput: 'noise', seconds: 1 })).toMatchObject({ kind: 'unchanged' });
  });
});
