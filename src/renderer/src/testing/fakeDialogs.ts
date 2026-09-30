import { beforeEach } from 'vitest';

/**
 * Stand-ins for the dialogs that ask the user (`ui/dialog/confirm`, `ui/dialog/prompt`), which render React. A test
 * mocks each with this module (`vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'))`), tells
 * what the user answers (`answerConfirms`, `answerPrompts`) and reads what was asked (`askedDialogs`). A confirm left
 * without an answer is accepted, a prompt cancelled. Each test starts with no answers and nothing asked.
 */

export interface AskedDialog {
  kind: 'confirm' | 'prompt';
  title: string;
  /** What a prompt's field starts with. */
  initialValue?: string;
  /** A prompt's check of what the user types: why it can't be used, or undefined when it can. */
  validate?: (value: string) => string | undefined;
}

const confirmAnswers: boolean[] = [];
const promptAnswers: (string | undefined)[] = [];
const asked: AskedDialog[] = [];

/** Whether the user accepts the next confirms, in order. */
export function answerConfirms(...answers: boolean[]): void {
  confirmAnswers.push(...answers);
}

/** What the user types in the next prompts, in order; undefined cancels one. */
export function answerPrompts(...answers: (string | undefined)[]): void {
  promptAnswers.push(...answers);
}

/** The dialogs asked so far, in order. */
export function askedDialogs(): AskedDialog[] {
  return [...asked];
}

export async function confirm({ title }: { title: string }): Promise<boolean> {
  asked.push({ kind: 'confirm', title });
  return confirmAnswers.shift() ?? true;
}

export async function prompt({ title, initialValue, validate }: Omit<AskedDialog, 'kind'>): Promise<string | undefined> {
  asked.push({ kind: 'prompt', title, initialValue, validate });
  return promptAnswers.shift();
}

beforeEach(() => {
  confirmAnswers.length = 0;
  promptAnswers.length = 0;
  asked.length = 0;
});
