import { indexCandidates, type CandidateIndex } from './candidateRanking';
import { displayName, userFilterTexts } from './userName';

/**
 * People indexed for each key typed (`rankCandidates`), the same way wherever they're found (a comment's mentions,
 * the palette's `@`): named by how `cm` names them and by the name shown, matched as a list's filter matches a user
 * (`userFilterTexts`).
 */
export function indexPeople(people: readonly string[]): CandidateIndex<string> {
  return indexCandidates(people, (person) => [person, displayName(person)], userFilterTexts);
}
