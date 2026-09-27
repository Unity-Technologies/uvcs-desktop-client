import { ELLIPSIS, trimMiddleToFit } from '../../lib/trimToFit';
import type { MergeTitle } from './mergeDescription';

type Measure = (text: string) => number;

/**
 * A merge title shortened to `width`: the words stay whole and the branches give way from their middle
 * (`/main/…/child_1/task`), the wider one first, one folder at a time, until both fit; when even their names don't,
 * the wider name loses its middle, then the other. Measured together, so nothing is left over between them.
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
  let [fittedSource, fittedDestination] = [source[s]!, destination[d]!];
  if (measure(fittedSource) + measure(fittedDestination) > room) {
    if (measure(fittedSource) >= measure(fittedDestination)) {
      fittedSource = trimName(fittedSource, Math.max(room - measure(fittedDestination), room / 2), measure);
      fittedDestination = trimName(fittedDestination, room - measure(fittedSource), measure);
    } else {
      fittedDestination = trimName(fittedDestination, Math.max(room - measure(fittedSource), room / 2), measure);
      fittedSource = trimName(fittedSource, room - measure(fittedDestination), measure);
    }
  }
  return fittedSource === title.source && fittedDestination === title.destination ? title : { ...title, source: fittedSource, destination: fittedDestination };
}

/**
 * `…/feature-with-a-long-name` → `…/featur…g-name`: the branch's name cut in the middle, what's before it kept. Never
 * shorter than a few characters each side of the cut, so it still reads as that branch.
 */
function trimName(branch: string, width: number, measure: Measure): string {
  const nameStart = branch.lastIndexOf('/') + 1;
  const folder = branch.slice(0, nameStart);
  const name = Array.from(branch.slice(nameStart));
  if (name.length <= 2 * NAME_ENDS + 1) return branch;
  const narrowest = measure(name.slice(0, NAME_ENDS).join('') + ELLIPSIS + name.slice(-NAME_ENDS).join(''));
  return folder + trimMiddleToFit(name.join(''), Math.max(width - measure(folder), narrowest), measure);
}

/** Characters a cut name keeps at least at each end. */
const NAME_ENDS = 3;

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
