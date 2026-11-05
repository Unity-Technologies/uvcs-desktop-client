import { describe, expect, it } from 'vitest';
import { commandLineTokens, type CommandLineTokenKind } from './commandLineTokens';

/** The line's tokens as `[kind, text]`, trimmed of the spaces plain text joins, and leaving out spaces alone. */
function tokensOf(line: string): [CommandLineTokenKind, string][] {
  return commandLineTokens(line)
    .map((token): [CommandLineTokenKind, string] => [token.kind, line.slice(token.start, token.end).trim()])
    .filter(([, text]) => text !== '');
}

describe('commandLineTokens', () => {
  it('covers the whole line, in order, so nothing is lost when it is drawn', () => {
    const line = "cm find branch where name = 'a b'  --format={id}␟{name}␞ --nototal";
    const tokens = commandLineTokens(line);
    expect(tokens.map((token) => line.slice(token.start, token.end)).join('')).toBe(line);
    tokens.forEach((token, index) => expect(token.start).toBe(index === 0 ? 0 : tokens[index - 1]!.end));
  });

  it('tells cm, the command and its options apart', () => {
    expect(tokensOf('cm status --header --xml --encoding=utf-8')).toEqual([
      ['program', 'cm'],
      ['command', 'status'],
      ['option', '--header'],
      ['option', '--xml'],
      ['option', '--encoding='],
      ['value', 'utf-8'],
    ]);
  });

  it('colors a subcommand as part of the command', () => {
    expect(tokensOf('cm lock list --anystatus --repository=Game@local')).toEqual([
      ['program', 'cm'],
      ['command', 'lock'],
      ['command', 'list'],
      ['option', '--anystatus'],
      ['option', '--repository='],
      ['value', 'Game@local'],
    ]);
  });

  it("leaves a command's second word plain when the command takes no subcommand", () => {
    expect(tokensOf('cm add readme.txt')).toEqual([
      ['program', 'cm'],
      ['command', 'add'],
      ['plain', 'readme.txt'],
    ]);
  });

  it("leaves a second word that can't be a subcommand plain, such as an xlink's path", () => {
    expect(tokensOf('cm branch br:/main/task')).toEqual([
      ['program', 'cm'],
      ['command', 'branch'],
      ['plain', 'br:/main/task'],
    ]);
  });

  it('keeps a path argument plain, with its spaces and accents', () => {
    expect(tokensOf('cm getworkspacefrompath /Users/ana/Mis juegos/Área --format={wkname}␟{guid}␞')).toEqual([
      ['program', 'cm'],
      ['command', 'getworkspacefrompath'],
      ['plain', '/Users/ana/Mis juegos/Área'],
      ['option', '--format='],
      ['field', '{wkname}'],
      ['separator', '␟'],
      ['field', '{guid}'],
      ['separator', '␞'],
    ]);
  });

  it('keeps a Windows path plain', () => {
    expect(tokensOf('cm getworkspacefrompath C:\\Users\\ana\\game')).toEqual([
      ['program', 'cm'],
      ['command', 'getworkspacefrompath'],
      ['plain', 'C:\\Users\\ana\\game'],
    ]);
  });

  it("tells a format's fields from the text around them and from the separators", () => {
    expect(tokensOf('cm find branch --format=br:{name}␟{date}␞')).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'branch'],
      ['option', '--format='],
      ['value', 'br:'],
      ['field', '{name}'],
      ['separator', '␟'],
      ['field', '{date}'],
      ['separator', '␞'],
    ]);
  });

  it("colors a find query's keywords, operators, strings and numbers", () => {
    const line =
      "cm find changeset where changesetid > 255 and branch = '/main/child br' order by changesetid desc limit 101 --format={changesetid}␟{owner}␞ --nototal";
    expect(tokensOf(line)).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'changeset'],
      ['keyword', 'where'],
      ['plain', 'changesetid'],
      ['operator', '>'],
      ['number', '255'],
      ['keyword', 'and'],
      ['plain', 'branch'],
      ['operator', '='],
      ['string', "'/main/child br'"],
      ['keyword', 'order'],
      ['keyword', 'by'],
      ['plain', 'changesetid'],
      ['keyword', 'desc'],
      ['keyword', 'limit'],
      ['number', '101'],
      ['option', '--format='],
      ['field', '{changesetid}'],
      ['separator', '␟'],
      ['field', '{owner}'],
      ['separator', '␞'],
      ['option', '--nototal'],
    ]);
  });

  it('reads a query\'s keywords in any case and its other operators', () => {
    expect(tokensOf("cm find shelve WHERE date >= '2026-08-05' AND owner != 'me' or comment like 'Auto%'")).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'shelve'],
      ['keyword', 'WHERE'],
      ['plain', 'date'],
      ['operator', '>='],
      ['string', "'2026-08-05'"],
      ['keyword', 'AND'],
      ['plain', 'owner'],
      ['operator', '!='],
      ['string', "'me'"],
      ['keyword', 'or'],
      ['plain', 'comment'],
      ['keyword', 'like'],
      ['string', "'Auto%'"],
    ]);
  });

  it('runs a string left open to the end of the line', () => {
    expect(tokensOf("cm find branch where name = 'open --nototal")).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'branch'],
      ['keyword', 'where'],
      ['plain', 'name'],
      ['operator', '='],
      ['string', "'open --nototal"],
    ]);
  });

  it('reads quotes and keywords only in a find query: elsewhere they are names', () => {
    expect(tokensOf("cm add 'quoted and 42")).toEqual([
      ['program', 'cm'],
      ['command', 'add'],
      ['plain', "'quoted and 42"],
    ]);
  });

  it('keeps a lone dash plain and reads a short option', () => {
    expect(tokensOf('cm xlink -s - lib')).toEqual([
      ['program', 'cm'],
      ['command', 'xlink'],
      ['option', '-s'],
      ['plain', '- lib'],
    ]);
  });

  it('draws a run of plain words and spaces as one token, however many paths a command takes', () => {
    const line = 'cm add a.txt b.txt c.txt';
    expect(commandLineTokens(line).map((token) => [token.kind, line.slice(token.start, token.end)])).toEqual([
      ['program', 'cm'],
      ['plain', ' '],
      ['command', 'add'],
      ['plain', ' a.txt b.txt c.txt'],
    ]);
  });

  it('reads the end of a query run with no workspace: on repository', () => {
    expect(tokensOf("cm find branch where name = 'x' on repository 'Game@local:8087' --nototal")).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'branch'],
      ['keyword', 'where'],
      ['plain', 'name'],
      ['operator', '='],
      ['string', "'x'"],
      ['keyword', 'on'],
      ['keyword', 'repository'],
      ['string', "'Game@local:8087'"],
      ['option', '--nototal'],
    ]);
  });

  it("reads a query's owners in parentheses, the parentheses plain", () => {
    expect(tokensOf("cm find branch where (owner = 'me' or owner = 'ana') limit 50")).toEqual([
      ['program', 'cm'],
      ['command', 'find'],
      ['command', 'branch'],
      ['keyword', 'where'],
      ['plain', '(owner'],
      ['operator', '='],
      ['string', "'me'"],
      ['keyword', 'or'],
      ['plain', 'owner'],
      ['operator', '='],
      ['string', "'ana'"],
      ['plain', ')'],
      ['keyword', 'limit'],
      ['number', '50'],
    ]);
  });

  it("colors a changelist's subcommand, after its name when it adds or removes files", () => {
    expect(tokensOf('cm changelist art add /w/a.png')).toEqual([
      ['program', 'cm'],
      ['command', 'changelist'],
      ['plain', 'art'],
      ['command', 'add'],
      ['plain', '/w/a.png'],
    ]);
    expect(tokensOf('cm changelist create art Textures --persistent')).toEqual([
      ['program', 'cm'],
      ['command', 'changelist'],
      ['command', 'create'],
      ['plain', 'art Textures'],
      ['option', '--persistent'],
    ]);
    expect(tokensOf('cm changelist edit add rename art')).toEqual([
      ['program', 'cm'],
      ['command', 'changelist'],
      ['command', 'edit'],
      ['plain', 'add rename art'],
    ]);
  });

  it('reads an empty line and cm alone', () => {
    expect(commandLineTokens('')).toEqual([]);
    expect(tokensOf('cm')).toEqual([['program', 'cm']]);
  });
});
