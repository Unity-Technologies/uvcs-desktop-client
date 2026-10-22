import { describe, expect, it } from 'vitest';
import { LinkRequests } from './LinkRequests';

describe('LinkRequests', () => {
  it('holds the links that come before the first windows opened, then hands them over in order', () => {
    const opened: string[] = [];
    const links = new LinkRequests((link) => opened.push(link));

    links.received('uvcs://local/repos/game/changesets/1');
    links.received('uvcs://local/repos/game/changesets/2');
    expect(opened).toEqual([]);

    links.windowsOpened();
    expect(opened).toEqual(['uvcs://local/repos/game/changesets/1', 'uvcs://local/repos/game/changesets/2']);
  });

  it('hands a link over at once once the windows are open, and each one only once', () => {
    const opened: string[] = [];
    const links = new LinkRequests((link) => opened.push(link));
    links.received('uvcs://local/repos/game');
    links.windowsOpened();

    links.received('uvcs://local/repos/tools');
    links.windowsOpened();
    expect(opened).toEqual(['uvcs://local/repos/game', 'uvcs://local/repos/tools']);
  });
});
