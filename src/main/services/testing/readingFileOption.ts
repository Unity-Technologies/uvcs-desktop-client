import { readFileSync } from 'node:fs';
import { optionValue, type CmAnswer, type CmFailure } from '../../cm/testing/fakeCmClient';

/** The file a command was given in an option (`-commentsfile=`), and what it held while the command ran. */
export interface FileSeen {
  file: string;
  content: string;
}

/**
 * Answers a command that takes text through a temp file (`-commentsfile=`, `--valuecontents=`) with `answer`, keeping
 * the file's path and what it held while the command ran, so a test can check the text and that the file is gone.
 */
export function readingFileOption(prefix: string, answer: string | CmFailure = ''): { seen: FileSeen; answer: CmAnswer } {
  const seen: FileSeen = { file: '', content: '' };
  return {
    seen,
    answer: ({ args }) => {
      seen.file = optionValue(args, prefix) ?? '';
      seen.content = readFileSync(seen.file, 'utf8');
      return answer;
    },
  };
}
