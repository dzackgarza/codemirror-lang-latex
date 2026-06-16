import { test, expect } from 'bun:test';
import { highlightTree, classHighlighter } from '@lezer/highlight';
import { latexLanguage } from '../src/latex-language';

const parser = latexLanguage.parser;

// The highlight classes the fused parser assigns to the first occurrence of
// `needle` (via the standard classHighlighter: tag -> "tok-..."). '' = unstyled.
function classesAt(input: string, needle: string): string {
  const pos = input.indexOf(needle);
  if (pos < 0) throw new Error(`needle not found: ${JSON.stringify(needle)}`);
  let cls = '';
  highlightTree(parser.parse(input), classHighlighter, (from, to, classes) => {
    if (from <= pos && pos < to) cls = classes;
  });
  return cls;
}

// The node-name ancestry at the first occurrence of `needle`, innermost first.
function ancestryAt(input: string, needle: string): string[] {
  const pos = input.indexOf(needle);
  const names: string[] = [];
  for (let n = parser.parse(input).resolveInner(pos, 1); n; n = n.parent) names.push(n.name);
  return names;
}

// ── Non-negotiable invariant: math stays LaTeX (a hole in the markdown overlay).
test('math regions keep LaTeX highlighting (hole preserved)', () => {
  expect(classesAt('a $\\zeta(2)$ b\n', '\\zeta')).toContain('keyword');
  expect(classesAt('$$\n\\int_0^1 x\\,dx\n$$\n', '\\int')).toContain('keyword');
});

// ── CommonMark constructs that already work.
test('headings, emphasis, strong, links are highlighted', () => {
  expect(classesAt('# Heading line\n', 'Heading')).toContain('heading');
  expect(classesAt('a *emstar* b\n', 'emstar')).toContain('emphasis');
  expect(classesAt('a **strongx** b\n', 'strongx')).toContain('strong');
  expect(classesAt('a [lt](http://theurl) b\n', 'theurl')).toContain('link');
  expect(ancestryAt('a ![imgalt](p.png) b\n', 'imgalt')).toContain('Image');
});

// ── Lists and blockquotes parse as block structures.
test('lists and blockquotes are parsed', () => {
  expect(ancestryAt('intro\n\n- bulletitem\n', 'bulletitem')).toContain('BulletList');
  expect(ancestryAt('intro\n\n1. ordereditem\n', 'ordereditem')).toContain('OrderedList');
  expect(ancestryAt('intro\n\n> quotetext\n', 'quotetext')).toContain('Blockquote');
});

// ── Inline code and strikethrough: the reference grammar marks the DELIMITERS
// (the content stays in the editor's monospace / gets the highlight style's
// line-through), so the construct is recognised and its marks are highlighted.
test('inline code is recognised and its delimiters marked', () => {
  expect(ancestryAt('a `codespan` b\n', 'codespan')).toContain('InlineCode');
  expect(classesAt('a `codespan` b\n', '`')).not.toBe('');
});

test('strikethrough is recognised and its delimiters marked', () => {
  expect(ancestryAt('a ~~strikex~~ b\n', 'strikex')).toContain('Strikethrough');
  expect(classesAt('a ~~strikex~~ b\n', '~~')).not.toBe('');
});

// ── Pandoc fenced divs: the fence line is recognised and marked.
test('fenced div fence is recognised and marked', () => {
  expect(classesAt('intro\n\n:::note\ndivcontent\n:::\n', ':::')).not.toBe('');
});

// ── Genuine grammar gap (RED until the '_' passthrough token is added).
test('underscore emphasis is highlighted', () => {
  expect(classesAt('a _emunder_ b\n', 'emunder')).toContain('emphasis');
});
