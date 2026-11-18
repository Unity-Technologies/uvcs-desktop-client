import { describe, expect, it } from 'vitest';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './formatRecords';
import { RepeatedPromptWatch } from './repeatedPrompt';

const SIGN_IN_MENU = 'Select the system you want to use to sign in to: codice@cloud\n0 - Okta Unity\n1 - Unity ID\n';
const SIGN_IN_PROMPT = 'Select your system [0-1] ';

/** The output given to a new watch as text, in chunks of `size` characters; the prompt it found, if any. */
function promptIn(output: string, size = output.length): string | undefined {
  const watch = new RepeatedPromptWatch();
  for (let start = 0; start < output.length; start += size) watch.appendText(output.slice(start, start + size));
  return watch.prompt;
}

describe('RepeatedPromptWatch', () => {
  it('finds the prompt cm asks again and again once its input is closed, wherever the chunks cut it', () => {
    const output = SIGN_IN_MENU + SIGN_IN_PROMPT.repeat(200);
    for (const size of [1, 7, 64, 1000, output.length]) expect(promptIn(output, size), `chunks of ${size}`).toBe('Select your system [0-1]');
  });

  it('finds it in bytes, a character of several bytes split between the chunks', () => {
    const watch = new RepeatedPromptWatch();
    const bytes = Buffer.from('サインインに使うシステムを選択してください [0-1] '.repeat(200), 'utf8');
    for (let start = 0; start < bytes.length; start += 1000) watch.appendBytes(bytes.subarray(start, start + 1000));
    expect(watch.prompt).toBe('サインインに使うシステムを選択してください [0-1]');
  });

  it('finds no loop in a prompt asked once, as cm asks before it fails', () => {
    expect(promptIn(`${SIGN_IN_MENU}${SIGN_IN_PROMPT}Error: no input`)).toBeUndefined();
  });

  it('finds no loop until the output repeats it long enough to tell', () => {
    expect(promptIn(SIGN_IN_PROMPT.repeat(10))).toBeUndefined();
  });

  it('finds no prompt in lines or records that repeat, as a list may', () => {
    expect(promptIn('Enter a value [y/n]:\n'.repeat(500))).toBeUndefined();
    expect(promptIn(`1${FIELD_SEPARATOR}/main/task:${RECORD_SEPARATOR}\n`.repeat(500))).toBeUndefined();
  });

  it('finds no prompt in text that repeats without asking anything', () => {
    expect(promptIn('ab:'.repeat(1000))).toBeUndefined();
    expect(promptIn('----------'.repeat(500))).toBeUndefined();
    expect(promptIn('abcdefghij'.repeat(500))).toBeUndefined();
  });

  it('finds the loop only while the output still repeats it', () => {
    const watch = new RepeatedPromptWatch();
    watch.appendText(SIGN_IN_PROMPT.repeat(200));
    expect(watch.prompt).toBe('Select your system [0-1]');
    watch.appendText('\nError: cancelled');
    expect(watch.prompt).toBeUndefined();
  });
});
