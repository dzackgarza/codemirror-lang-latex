import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { markdownOutline } from '../src/pandoc-markdown';

const doc = readFileSync(new URL('./fixtures/outline.md', import.meta.url), 'utf8');

test('outline lists headings and fenced divs with labels, depth, and line', () => {
  const items = markdownOutline(doc);
  expect(items).toEqual([
    { kind: 'heading', level: 1, depth: 0, label: 'Top Heading', line: 1 },
    { kind: 'heading', level: 2, depth: 1, label: 'Sub Heading', line: 5 },
    { kind: 'div', level: 1, depth: 2, label: 'Remark', line: 7 },
    { kind: 'div', level: 1, depth: 2, label: 'Theorem: Main Result', line: 13 },
    { kind: 'div', level: 2, depth: 3, label: 'Proof', line: 15 },
  ]);
});

test('a div with no class renders as "Div"', () => {
  expect(markdownOutline(':::{ #id }\nx\n:::\n')[0].label).toBe('Div');
});

test('div class is capitalised; title is appended after a colon', () => {
  expect(markdownOutline(':::{.lemma}\n:::\n')[0].label).toBe('Lemma');
  expect(markdownOutline(':::{.remark title="ABCD"}\n:::\n')[0].label).toBe(
    'Remark: ABCD',
  );
});
