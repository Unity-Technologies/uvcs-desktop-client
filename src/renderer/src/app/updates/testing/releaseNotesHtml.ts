/**
 * Release notes as GitHub renders them into the releases feed, for the What's New tests: the format the Release
 * workflow writes (groups and notes) and GitHub's generated one (a list of pull requests).
 */

const REPOSITORY = 'https://github.com/Unity-Technologies/uvcs-desktop-client';

/** A pull request as GitHub's generated notes list it: its title, then who opened it and where. */
export function generatedItem(title: string, user: string, pullRequest: number): string {
  return (
    `<li>${title} by <a class="user-mention notranslate" data-hovercard-type="user" data-hovercard-url="/users/${user}/hovercard" data-octo-click="hovercard-link-click" data-octo-dimensions="link_type:self" href="https://github.com/${user}">@${user}</a>` +
    ` in <a class="issue-link js-issue-link" data-error-text="Failed to load title" data-id="6078491168" data-permission-text="Title is private" data-url="${REPOSITORY}/issues/${pullRequest}" data-hovercard-type="pull_request" data-hovercard-url="/Unity-Technologies/uvcs-desktop-client/pull/${pullRequest}/hovercard" href="${REPOSITORY}/pull/${pullRequest}">#${pullRequest}</a></li>`
  );
}

export function fullChangelogLine(from: string, to: string): string {
  return `<p><strong>Full Changelog</strong>: <a class="commit-link" href="${REPOSITORY}/compare/v${from}...v${to}"><tt>v${from}...v${to}</tt></a></p>`;
}

/** GitHub's generated notes: "What's Changed", the pull requests, maybe the new contributors, and the full changelog. */
export function generatedNotes(items: string[], { newContributors = [] as string[], from = '0.2.3', to = '0.2.4' } = {}): string {
  const contributors =
    newContributors.length > 0
      ? `<h2>New Contributors</h2>\n<ul>\n${newContributors.map((user) => `<li><a class="user-mention notranslate" href="https://github.com/${user}">@${user}</a> made their first contribution in <a class="issue-link js-issue-link" href="${REPOSITORY}/pull/1">#1</a></li>`).join('\n')}\n</ul>\n`
      : '';
  return `<h2>What's Changed</h2>\n<ul>\n${items.join('\n')}\n</ul>\n${contributors}${fullChangelogLine(from, to)}`;
}

export const group = (name: string): string => `<h2 dir="auto">${name}</h2>`;
export const note = (title: string, ...description: string[]): string => [`<h3 dir="auto">${title}</h3>`, ...description].join('\n');
export const paragraph = (html: string): string => `<p dir="auto">${html}</p>`;

/** A picture as GitHub renders one: in a link to itself. */
export function picture(url: string, alt: string): string {
  return `<p dir="auto"><a target="_blank" rel="noopener noreferrer" href="${url}"><img src="${url}" alt="${alt}" style="max-width: 100%;"></a></p>`;
}
