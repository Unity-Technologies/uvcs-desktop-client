import { describe, expect, it } from 'vitest';
import { parseCodeReviews } from './codeReviewsXml';
import { parseItemDetails } from './itemDetailsXml';
import { parseLocks } from './lockRecords';
import { parseTreeItems } from './treeItemsXml';

const LS_XML = `<?xml version="1.0" encoding="utf-8"?>
<LsResults><LsItems>
  <LsItem><Status>Controlled</Status><Name>.</Name><WkPath>src</WkPath><Type>dir</Type></LsItem>
  <LsItem>
    <Status>Controlled</Status><Name>core</Name><WkPath>src/core</WkPath><Size>0</Size><Type>dir</Type>
    <Changeset>2</Changeset><Owner>jane@unity.com</Owner><Checkout /><RevId>52</RevId><ParentRevId>37</ParentRevId>
    <ItemId>36</ItemId><Branch>/main</Branch><Date>2026-09-25T09:41:47+02:00</Date>
  </LsItem>
  <LsItem><Status>Private</Status><Name>notes.txt</Name><WkPath>src\\notes.txt</WkPath><Size>5</Size><Type>txt</Type><Checkout /></LsItem>
  <LsItem><Status>Controlled</Status><Name>logo.png</Name><WkPath>/src/logo.png</WkPath><Type>bin</Type><Checkout>CO</Checkout>
    <Date>0001-01-01T00:00:00Z</Date></LsItem>
</LsItems></LsResults>`;

describe('parseTreeItems', () => {
  it('skips the listed directory and maps each child', () => {
    const items = parseTreeItems(LS_XML);
    expect(items.map((item) => item.path)).toEqual(['src/core', 'src/notes.txt', 'src/logo.png']);
    expect(items[0]).toMatchObject({ itemType: 'directory', changeset: 2, revisionId: 52, parentRevisionId: 37, isPrivate: false });
    expect(items[1]).toMatchObject({ itemType: 'file', isPrivate: true, size: 5 });
    expect(items[2]).toMatchObject({ itemType: 'binaryFile', isCheckedOut: true, date: '' });
  });

  it('reads symbolic links as links, with where they point', () => {
    const xml = `<LsResults><LsItems>
      <LsItem><Status>Private</Status><Name>linkdir</Name><WkPath>linkdir</WkPath><Size>3</Size><Type>link</Type>
        <SymlinkTarget> -&gt; src</SymlinkTarget></LsItem>
      <LsItem><Status>Controlled</Status><Name>main.ts</Name><WkPath>main.ts</WkPath><Type>txt</Type><SymlinkTarget /></LsItem>
    </LsItems></LsResults>`;
    const [link, file] = parseTreeItems(xml);
    expect(link).toMatchObject({ itemType: 'symlink', isPrivate: true, symlinkTarget: 'src' });
    expect(file).not.toHaveProperty('symlinkTarget');
  });

  it('reads the repository of each item: the xlinked one under an xlink, and for the xlink itself', () => {
    // `cm ls 01plastic/src/client/plugins --xml` in codice@codice@cloud, trimmed.
    const xml = `<LsResults><LsItems>
      <LsItem><Status>Controlled</Status><Name>bamboo-81-plasticscm-plugin</Name>
        <WkPath>01plastic/src/client/plugins/bamboo-81-plasticscm-plugin</WkPath><Type>dir</Type>
        <Repository>rep:codice@codice@cloud</Repository><RevId>31045109</RevId><Server>codice@cloud</Server></LsItem>
      <LsItem><Status>Controlled</Status><Name>bamboo-plasticscm-plugin -&gt; wxlink -&gt; / 6696@plugins/bambooplugin@ [relative] codice@cloud</Name>
        <WkPath>01plastic/src/client/plugins/bamboo-plasticscm-plugin</WkPath><Type>dir</Type>
        <Repository>rep:plugins/bambooplugin@codice@cloud</Repository><RevId>278093</RevId><Server>codice@cloud</Server></LsItem>
      <LsItem><Status>Controlled</Status><Name>CreatePath.cs</Name>
        <WkPath>01plastic/src/client/plugins/unity-plugin/Packages/com.unity.collab-proxy.tests/Infrastructure/CreatePath.cs</WkPath><Type>txt</Type>
        <Changeset>8285</Changeset><Repository>rep:unityGUI@codice@cloud</Repository><RevId>175536</RevId><ParentRevId>-1</ParentRevId>
        <Server>codice@cloud</Server><Branch>/main/scm1004207</Branch></LsItem>
      <LsItem><Status>Private</Status><Name>.DS_Store</Name><WkPath>01plastic/src/client/plugins/.DS_Store</WkPath><Type>bin</Type>
        <Changeset /><Repository /><RevId /></LsItem>
    </LsItems></LsResults>`;
    expect(parseTreeItems(xml).map(({ name, revisionId, repository }) => ({ name, revisionId, repository }))).toEqual([
      { name: 'bamboo-81-plasticscm-plugin', revisionId: 31045109, repository: 'codice@codice@cloud' },
      { name: 'bamboo-plasticscm-plugin', revisionId: 278093, repository: 'plugins/bambooplugin@codice@cloud' },
      { name: 'CreatePath.cs', revisionId: 175536, repository: 'unityGUI@codice@cloud' },
      { name: '.DS_Store', revisionId: -1, repository: '' },
    ]);
  });

  it('names an xlink after its path and reads where it points', () => {
    const xml = `<LsResults><LsItems>
      <LsItem><Status>Controlled</Status><Name>third -&gt; wxlink -&gt; / 17568@nervathirdparty@ [relative] codice@cloud</Name>
        <WkPath>libs/third</WkPath><Type>dir</Type></LsItem>
    </LsItems></LsResults>`;
    expect(parseTreeItems(xml)[0]).toMatchObject({
      name: 'third',
      itemType: 'directory',
      xlink: { writable: true, repository: 'nervathirdparty', changeset: 17568, path: '/' },
    });
  });
});

describe('parseItemDetails', () => {
  it('reads the fileinfo fields', () => {
    const xml = `<FileInfos><FileInfo><ServerPath>/README.md</ServerPath><Status>controlled</Status>
      <RevisionChangeset>1</RevisionChangeset><RepSpec>repo@local</RepSpec><Changelist /></FileInfo></FileInfos>`;
    expect(parseItemDetails(xml)).toMatchObject({ serverPath: '/README.md', loadedChangeset: 1, repository: 'repo@local', changelist: '' });
  });
});

describe('parseLocks', () => {
  it('parses the smart locks layout', () => {
    const line = ['repo', '41', 'guid-1', '2026-09-25T09:43:06+02:00', '/main', '19', '/main/task', '55', 'Retained', 'jane', 'wk', '/a.psd'];
    const [lock] = parseLocks(`${line.join('\u001f')}\u001e\n`, 'local');
    expect(lock).toEqual({
      repository: 'repo@local',
      itemId: 41,
      guid: 'guid-1',
      date: '2026-09-25T09:43:06+02:00',
      destinationBranch: '/main',
      holderBranch: '/main/task',
      status: 'Retained',
      owner: 'jane',
      workspace: 'wk',
      path: '/a.psd',
    });
  });
});

describe('parseCodeReviews', () => {
  it('strips the status type name and splits the target', () => {
    const xml = `<PLASTICQUERY>
      <REVIEW><ID>60</ID><TITLE>Branch review</TITLE><CODEREVIEWSTATUS>CodeReviewStatus Rework required</CODEREVIEWSTATUS>
        <TARGETTYPE>Branch</TARGETTYPE><TARGET>id:54</TARGET><ASSIGNEE></ASSIGNEE></REVIEW>
      <REVIEW><ID>62</ID><TITLE>Changeset review</TITLE><STATUS>Status Reviewed</STATUS>
        <TARGETTYPE>Changeset</TARGETTYPE><TARGET>2</TARGET></REVIEW>
      <REVIEW><ID>63</ID><TITLE>Shelve review</TITLE><STATUS>Status Under review</STATUS>
        <TARGETTYPE>Shelve</TARGETTYPE><TARGET>3</TARGET></REVIEW>
    </PLASTICQUERY>`;
    expect(parseCodeReviews(xml)).toMatchObject([
      { id: 60, status: 'Rework required', targetType: 'branch', targetId: 54, assignee: '' },
      { id: 62, status: 'Reviewed', targetType: 'changeset', targetId: 2 },
      { id: 63, status: 'Under review', targetType: 'shelve', targetId: 3 },
    ]);
  });
});
