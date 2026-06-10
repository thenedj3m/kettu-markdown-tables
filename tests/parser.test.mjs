import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform } from '@swc/core';

const source = await readFile('plugins/markdownTables/src/parser.ts', 'utf8');
const { code } = await transform(source, { filename: 'parser.ts', jsc: { parser: { syntax: 'typescript' }, target: 'es2020' }, module: { type: 'es6' }});
const dir = await mkdtemp(join(tmpdir(), 'mdtables-'));
const modPath = join(dir, 'parser.mjs');
await writeFile(modPath, code);
const { renderMarkdownTables, parseMarkdownTables } = await import(modPath);

const input = '| Name | Count | Note |\n|---|---:|:---:|\n| A | 1 | x |\n| B\\|C | 22 | yy |';
const output = renderMarkdownTables(input);
assert.match(output, /^```\nName/);
assert.match(output, /Name\s+│\s+Count\s+│\s+Note/);
assert.match(output, /────────────/);
assert.match(output, /B\|C/);
assert.doesNotMatch(output, /[┌┐└┘]/);
const parsed = parseMarkdownTables(input);
assert.equal(parsed.length, 1);
assert.deepEqual(parsed[0].header, ['Name', 'Count', 'Note']);
assert.deepEqual(parsed[0].alignments, ['left', 'right', 'center']);
assert.equal(parsed[0].rows[1][0], 'B|C');

const wide = '| 観点 | Agent Reach | 今のHermesリサーチスキル群 | 判定 |\n|---|---|---|---|\n| X/Twitter | twitter-cli頼みで横幅が長い | 既にlocal rate-limit policyあり | 良 |\n| Reddit | API/JSON endpoint重視 | permalinkで出す | 可 |';
const wideOutput = renderMarkdownTables(wide);
assert.match(wideOutput, /^```\n#1\n観点: X\/Twitter/m);
assert.match(wideOutput, /Agent Reach: twitter-cli頼みで横幅が長い/);
assert.match(wideOutput, /────────────\n#2\n観点: Reddit/);

const fenced = '```\n| A | B |\n|---|---|\n| 1 | 2 |\n```';
assert.equal(renderMarkdownTables(fenced), fenced);

const noTable = 'hello | world';
assert.equal(renderMarkdownTables(noTable), noTable);

console.log('parser tests passed');
