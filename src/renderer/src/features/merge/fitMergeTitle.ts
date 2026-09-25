import { ELLIPSIS } from '../../lib/trimToFit';
import type { MergeTitle } from './mergeDescription';

type Measure = (text: string) => number;

/**
 * A merge title shortened to `width`: the words stay whole and the branches give way from their middle
 * (`/main/…/child_1/task`), the wider one first, one folder at a time, until both fit. Measured together, so nothing
 * is left over between them.
 */
export function fitMergeTitle(title: MergeTitle, width: number, measure: Measure): MergeTitle {
  const room = width - measure(`${title.verb}  ${title.preposition}  `);
  const source = shorterForms(title.source);
  const destination = shorterForms(title.destination);
  let [s, d] = [0, 0];
  while (measure(source[s]!) + measure(destination[d]!) > room) {
    const sourceWider = measure(source[s]!) >= measure(destination[d]!);
    if (sourceWider && s < source.length - 1) s++;
    else if (d < destination.length - 1) d++;
    else if (s < source.length - 1) s++;
    else break;
  }
  return s === 0 && d === 0 ? title : { ...title, source: source[s]!, destination: destination[d]! };
}

/** `/main/a/b/task`, `/main/…/b/task`, `/main/…/task`, `…/task`: each one folder shorter, down to the name. */
function shorterForms(branch: string): string[] {
  const parts = branch.split('/');
  const name = parts.pop()!;
  const headEnd = parts[0] === '' ? 2 : 1;
  const head = parts.slice(0, headEnd).join('/');
  const middle = parts.slice(headEnd);
  const forms = [branch];
  for (let kept = middle.length - 1; kept >= 0 && parts.length > headEnd; kept--) {
    forms.push([head, ELLIPSIS, ...middle.slice(middle.length - kept), name].join('/'));
  }
  const nameOnly = `${ELLIPSIS}/${name}`;
  if (nameOnly.length < forms.at(-1)!.length) forms.push(nameOnly);
  return forms;
}
